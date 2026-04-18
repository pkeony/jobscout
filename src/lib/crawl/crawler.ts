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
import {
  normalizeIncruitUrl,
  parseIncruitHtml,
  type IncruitParseResult,
} from "./parsers/incruit";

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

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_SIZE) {
    throw new CrawlError("페이지 크기가 너무 큽니다", 400);
  }

  return decodeHtml(buffer, contentType);
}

/**
 * HTML 인코딩 디코딩.
 * 1. Content-Type 헤더의 charset 우선
 * 2. 없으면 UTF-8로 먼저 읽어서 <meta charset> 검사 (euc-kr, ks_c_5601 등 한국 레거시 사이트 대응)
 * 3. 그래도 실패/미지원이면 UTF-8 폴백
 */
function decodeHtml(buffer: ArrayBuffer, contentType: string): string {
  const headerCharset = extractCharset(contentType);
  if (headerCharset && headerCharset !== "utf-8") {
    const decoded = tryDecode(buffer, headerCharset);
    if (decoded !== null) return decoded;
  }

  // UTF-8로 선디코딩 후 <meta http-equiv="Content-Type"> 또는 <meta charset>에서 charset 추출
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const metaCharset = extractMetaCharset(utf8);
  if (metaCharset && metaCharset !== "utf-8") {
    const decoded = tryDecode(buffer, metaCharset);
    if (decoded !== null) return decoded;
  }

  return utf8;
}

function extractCharset(contentType: string): string | null {
  const match = contentType.match(/charset\s*=\s*["']?([\w-]+)/i);
  if (!match) return null;
  return normalizeCharset(match[1]);
}

function extractMetaCharset(html: string): string | null {
  const head = html.slice(0, 4096);
  const explicit = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
  if (explicit) return normalizeCharset(explicit[1]);
  return null;
}

function normalizeCharset(raw: string): string {
  const lower = raw.trim().toLowerCase();
  // 한국 레거시 사이트가 쓰는 별칭들을 TextDecoder가 인식하는 표준 이름으로 매핑
  if (lower === "ks_c_5601-1987" || lower === "ksc5601" || lower === "cp949") {
    return "euc-kr";
  }
  return lower;
}

function tryDecode(buffer: ArrayBuffer, charset: string): string | null {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buffer);
  } catch {
    return null;
  }
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

function extractCompany($: cheerio.CheerioAPI, url: string): string {
  // 1. 호스트별 og:title/description 패턴 (og:site_name이 사이트명이라 쓸 수 없는 사이트들)
  const hostFallback = extractCompanyByHost($, url);
  if (hostFallback) return hostFallback;

  // 2. 채용 사이트 공통 selector
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

  // 3. og:site_name (마지막 폴백 — 사이트명일 가능성 높지만 일부 사이트는 진짜 회사명을 넣음)
  const siteName = $('meta[property="og:site_name"]').attr("content")?.trim();
  if (siteName) return siteName;

  return "회사명 미확인";
}

/**
 * 사이트별 회사명 추출 — og:site_name이 사이트명(점핏, 피플앤잡 등)이라 회사명으로 쓸 수 없는 케이스 보정.
 * - 점프핏: og:description = "{회사명} - {공고제목} 채용"
 * - 피플앤잡: og:title = "{직무} - {회사명한글}, {회사명영문} - 피플앤잡"
 */
function extractCompanyByHost($: cheerio.CheerioAPI, url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (host.endsWith("jumpit.saramin.co.kr")) {
    const desc = $('meta[property="og:description"]').attr("content")?.trim();
    if (desc) {
      const dashIdx = desc.indexOf(" - ");
      if (dashIdx > 0) {
        const candidate = desc.slice(0, dashIdx).trim();
        if (candidate && candidate.length <= 60) return candidate;
      }
    }
  }

  if (host.endsWith("peoplenjob.com")) {
    const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
    if (ogTitle) {
      const parts = ogTitle.split(" - ").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // 마지막은 사이트명 → 끝에서 두 번째가 회사명. 콤마로 한글/영문 분리되어 있으면 한글(앞) 우선
        const candidate = parts[parts.length - 2];
        const commaIdx = candidate.indexOf(",");
        const company = commaIdx > 0 ? candidate.slice(0, commaIdx).trim() : candidate;
        if (company && company.length <= 60 && company !== "피플앤잡") return company;
      }
    }
  }

  return null;
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
    ".description",
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

  // ─── 잡인크루트 전용: 메인 + iframe 조합 (잡코리아와 동일 패턴) ──
  const incruitInfo = normalizeIncruitUrl(url);
  if (incruitInfo) {
    const [mainHtml, iframeHtml] = await Promise.all([
      fetchHtml(url),
      fetchHtml(incruitInfo.contentUrl),
    ]);
    const parsed: IncruitParseResult | null = parseIncruitHtml(
      mainHtml,
      iframeHtml,
      url,
      incruitInfo.contentUrl,
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
  const company = extractCompany($, url);
  const text = extractBody($);

  if (text.length < 50) {
    throw new CrawlError(
      "채용공고 텍스트를 충분히 추출하지 못했습니다. 텍스트를 직접 붙여넣어 주세요.",
      422,
    );
  }

  return { title, company, text, url };
}
