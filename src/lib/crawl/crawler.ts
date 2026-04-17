import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";
import {
  normalizeSaraminUrl,
  parseSaraminHtml,
  type SaraminParseResult,
} from "./parsers/saramin";
import {
  normalizeJobkoreaUrl,
  parseJobkoreaHtml,
  type JobkoreaParseResult,
} from "./parsers/jobkorea";

const MAX_BODY_SIZE = 1_000_000; // 1MB
const FETCH_TIMEOUT_MS = 10_000;

class CrawlError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "CrawlError";
  }
}

// ─── SSRF 방지: private IP 차단 ─────────────────────

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
];

function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    if (BLOCKED_HOSTS.includes(hostname)) return true;
    if (hostname.startsWith("10.")) return true;
    if (hostname.startsWith("192.168.")) return true;
    if (hostname.startsWith("172.") && isPrivate172(hostname)) return true;
    if (!["http:", "https:"].includes(parsed.protocol)) return true;

    return false;
  } catch {
    return true;
  }
}

function isPrivate172(hostname: string): boolean {
  const parts = hostname.split(".");
  const second = parseInt(parts[1], 10);
  return second >= 16 && second <= 31;
}

// ─── HTML fetch ─────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  if (isBlockedUrl(url)) {
    throw new CrawlError("접근이 차단된 URL입니다", 400);
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; JobScout/1.0; +https://jobscout.dev)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });

  // 리디렉트 최종 호스트 재검증 — 공개 URL이 내부망·사설 IP로 튕겨지는 SSRF 경로 차단
  if (res.url && isBlockedUrl(res.url)) {
    throw new CrawlError("리디렉트가 허용되지 않은 호스트로 이동", 403);
  }

  if (!res.ok) {
    throw new CrawlError(
      `페이지를 불러올 수 없습니다 (HTTP ${res.status})`,
      502,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new CrawlError("HTML 페이지가 아닙니다", 400);
  }

  const text = await res.text();
  if (text.length > MAX_BODY_SIZE) {
    throw new CrawlError("페이지 크기가 너무 큽니다", 400);
  }

  return text;
}

// ─── 사이트별 전용 파서 ────────────────────────────

interface WantedAddress {
  full_location?: string;
  location?: string;
  country?: string;
}

interface WantedReward {
  formatted_total?: string;
  formatted_recommender?: string;
  formatted_recommendee?: string;
}

interface WantedCareer {
  annual_from?: number;
  annual_to?: number;
  is_newbie?: boolean;
  is_expert?: boolean;
}

interface WantedJob {
  position?: string;
  intro?: string;
  main_tasks?: string;
  requirements?: string;
  preferred_points?: string;
  benefits?: string;
  hire_rounds?: string | { title?: string }[];
  company?: { company_name?: string };
  address?: WantedAddress;
  reward?: WantedReward;
  employment_type?: string;
  employment_note?: string;
  career?: WantedCareer;
}

function formatCareer(career?: WantedCareer): string {
  if (!career) return "";
  if (career.is_newbie && !career.is_expert) return "신입";
  if (career.is_expert && !career.is_newbie) return "경력";
  const from = career.annual_from ?? 0;
  const to = career.annual_to ?? 0;
  if (from === 0 && to > 0) return `신입~${to}년`;
  if (from > 0 && to > 0) return `${from}~${to}년`;
  return "";
}

function normalizeHireRounds(rounds: WantedJob["hire_rounds"]): string {
  if (!rounds) return "";
  if (typeof rounds === "string") return rounds.trim();
  return rounds.map((r) => r.title).filter(Boolean).join(" → ");
}

function formatEmploymentType(type?: string): string {
  if (!type) return "";
  const map: Record<string, string> = {
    intern: "인턴",
    full_time: "정규직",
    contract: "계약직",
    part_time: "파트타임",
  };
  return map[type] ?? type;
}

function formatReward(reward?: WantedReward): string {
  if (!reward) return "";
  const parts: string[] = [];
  if (reward.formatted_recommendee) parts.push(`지원자 ${reward.formatted_recommendee}`);
  if (reward.formatted_recommender) parts.push(`추천인 ${reward.formatted_recommender}`);
  return parts.join(", ");
}

function tryWantedParser($: cheerio.CheerioAPI, url: string): CrawlResult | null {
  if (!url.includes("wanted.co.kr")) return null;

  const nextDataScript = $('script#__NEXT_DATA__').html();
  if (!nextDataScript) return null;

  try {
    const nextData = JSON.parse(nextDataScript) as {
      props?: { pageProps?: { initialData?: WantedJob } };
    };
    const job = nextData.props?.pageProps?.initialData;
    if (!job) return null;

    const sections: string[] = [];
    if (job.position) sections.push(`[직무명] ${job.position}`);

    const employment = formatEmploymentType(job.employment_type);
    const careerText = formatCareer(job.career);
    const locationText = job.address?.full_location ?? job.address?.location;
    const conditionParts: string[] = [];
    if (employment) conditionParts.push(employment);
    if (careerText) conditionParts.push(careerText);
    if (locationText) conditionParts.push(locationText);
    if (conditionParts.length) {
      sections.push(`[근무조건 요약] ${conditionParts.join(" · ")}`);
    }
    if (job.employment_note) {
      sections.push(`[고용 상세]\n${job.employment_note}`);
    }

    const rewardText = formatReward(job.reward);
    if (rewardText) sections.push(`[합격보상] ${rewardText}`);

    if (job.intro) sections.push(`[소개]\n${job.intro}`);
    if (job.main_tasks) sections.push(`[주요업무]\n${job.main_tasks}`);
    if (job.requirements) sections.push(`[자격요건]\n${job.requirements}`);
    if (job.preferred_points) sections.push(`[우대사항]\n${job.preferred_points}`);
    if (job.benefits) sections.push(`[혜택 및 복지]\n${job.benefits}`);

    const rounds = normalizeHireRounds(job.hire_rounds);
    if (rounds) sections.push(`[채용 전형]\n${rounds}`);

    const text = sections.join("\n\n");
    if (text.length < 50) return null;

    return {
      title: job.position ?? "제목 없음",
      company: job.company?.company_name ?? "회사명 미확인",
      text,
      url,
    };
  } catch {
    return null;
  }
}

// ─── Generic parser ─────────────────────────────────

function extractTitle($: cheerio.CheerioAPI): string {
  return (
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().trim() ||
    "제목 없음"
  );
}

function extractCompany($: cheerio.CheerioAPI): string {
  // og:site_name 메타 태그
  const siteName = $('meta[property="og:site_name"]').attr("content")?.trim();
  if (siteName) return siteName;

  // 채용 사이트 공통 패턴
  const companySelectors = [
    '[class*="company-name"]',
    '[class*="companyName"]',
    '[class*="company_name"]',
    '[data-company]',
  ];

  for (const selector of companySelectors) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }

  return "회사명 미확인";
}

function extractBody($: cheerio.CheerioAPI): string {
  // 불필요 요소 제거
  $("script, style, nav, footer, header, aside, iframe, noscript, svg").remove();

  // 본문 우선순위 탐색
  const contentSelectors = [
    "article",
    '[role="main"]',
    "main",
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[class*="job_description"]',
    '[class*="content"]',
    ".description',",
  ];

  for (const selector of contentSelectors) {
    const el = $(selector).first();
    if (el.length) {
      const text = el.text().trim();
      if (text.length >= 50) return cleanText(text);
    }
  }

  // fallback: body 전체
  const bodyText = $("body").text().trim();
  return cleanText(bodyText);
}

function cleanText(text: string): string {
  return text
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Public API ─────────────────────────────────────

export { CrawlError };

export interface CrawlJobResult extends CrawlResult {
  imageUrls?: string[];
  needsVisionOcr?: boolean;
}

export async function crawlJobDescription(url: string): Promise<CrawlJobResult> {
  // ─── 사람인 전용 ─────────────────────────────────
  const saraminUrl = normalizeSaraminUrl(url);
  if (saraminUrl) {
    const html = await fetchHtml(saraminUrl);
    const parsed: SaraminParseResult | null = parseSaraminHtml(html, saraminUrl);
    if (parsed) {
      if (parsed.result.text.length < 50 && parsed.imageUrls.length === 0) {
        throw new CrawlError(
          "채용공고 텍스트를 충분히 추출하지 못했습니다. 텍스트를 직접 붙여넣어 주세요.",
          422,
        );
      }
      return {
        ...parsed.result,
        imageUrls: parsed.imageUrls,
        needsVisionOcr: parsed.needsVisionOcr,
      };
    }
  }

  // ─── 잡코리아 전용: 메인 + iframe 조합 ──────────
  const jobkoreaInfo = normalizeJobkoreaUrl(url);
  if (jobkoreaInfo) {
    const [mainHtml, iframeHtml] = await Promise.all([
      fetchHtml(url),
      fetchHtml(jobkoreaInfo.contentUrl),
    ]);
    const parsed: JobkoreaParseResult | null = parseJobkoreaHtml(
      mainHtml,
      iframeHtml,
      url,
      jobkoreaInfo.contentUrl,
    );
    if (parsed) {
      if (parsed.result.text.length < 50 && parsed.imageUrls.length === 0) {
        throw new CrawlError(
          "채용공고 텍스트를 충분히 추출하지 못했습니다. 텍스트를 직접 붙여넣어 주세요.",
          422,
        );
      }
      return {
        ...parsed.result,
        imageUrls: parsed.imageUrls,
        needsVisionOcr: parsed.needsVisionOcr,
      };
    }
  }

  // ─── 원티드 / generic ──────────────────────────
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const wanted = tryWantedParser($, url);
  if (wanted) return wanted;

  const title = extractTitle($);
  const company = extractCompany($);
  const text = extractBody($);

  if (text.length < 50) {
    throw new CrawlError(
      "채용공고 텍스트를 충분히 추출하지 못했습니다. 텍스트를 직접 붙여넣어 주세요.",
      422,
    );
  }

  return { title, company, text, url };
}
