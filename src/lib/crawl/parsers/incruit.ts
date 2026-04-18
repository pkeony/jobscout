import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";

export const INCRUIT_IMAGE_HOSTS = [
  "c.incru.it",
  "image.incruit.com",
  "img.incruit.com",
  "job.incruit.com",
  "www.incruit.com",
];

const MIN_TEXT_LEN_FOR_NO_OCR = 300;

const IMAGE_EXCLUDE_PATTERNS = [
  /logo/i,
  /btn_/i,
  /icon_/i,
  /loading\.gif/i,
  /watermark/i,
  /_ad_/i,
  /banner/i,
];

export interface IncruitParseResult {
  result: CrawlResult;
  imageUrls: string[];
  needsVisionOcr: boolean;
  contentUrl: string;
}

/**
 * 잡인크루트 URL에서 job ID 추출.
 * 지원 패턴:
 *  - /jobdb_info/jobpost.asp?job={JOB_ID}
 *  - /jobpost.asp?job={JOB_ID}
 *  - 쿼리 ?job={JOB_ID}
 * iframe 본문 URL은 /s_common/jobpost/jobpostcont.asp?job={JOB_ID}
 */
export function normalizeIncruitUrl(url: string): { contentUrl: string; jobId: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith("incruit.com")) return null;

  const jobId = parsed.searchParams.get("job");
  if (!jobId || !/^\d+$/.test(jobId)) return null;

  // 이미 iframe 본문 URL이면 그대로
  const isContentPath = /\/s_common\/jobpost\/jobpostcont\.asp/i.test(parsed.pathname);
  if (isContentPath) {
    return {
      contentUrl: `https://job.incruit.com/s_common/jobpost/jobpostcont.asp?job=${jobId}`,
      jobId,
    };
  }

  return {
    contentUrl: `https://job.incruit.com/s_common/jobpost/jobpostcont.asp?job=${jobId}`,
    jobId,
  };
}

function cleanText(text: string): string {
  return text
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitleFromMain($: cheerio.CheerioAPI): string {
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) {
    // "회사명,공고제목 : 인크루트 채용" → "공고제목"
    const withoutSuffix = ogTitle.replace(/\s*:\s*인크루트\s*채용\s*$/, "").trim();
    const commaIdx = withoutSuffix.indexOf(",");
    if (commaIdx > 0) {
      const afterComma = withoutSuffix.slice(commaIdx + 1).trim();
      if (afterComma) return afterComma;
    }
    if (withoutSuffix) return withoutSuffix;
  }
  const titleTag = $("title").text().trim();
  return titleTag.replace(/\s*-\s*인크루트\s*채용\s*$/, "").trim() || "제목 없음";
}

function extractCompanyFromMain($: cheerio.CheerioAPI): string {
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) {
    // "회사명,공고제목 : 인크루트 채용" — 콤마 앞이 회사명
    const commaIdx = ogTitle.indexOf(",");
    if (commaIdx > 0) {
      const company = ogTitle.slice(0, commaIdx).trim();
      if (company && company !== "인크루트") return company;
    }
  }

  // DOM 폴백 — 잡인크루트 기업정보 영역
  const selectors = [
    "#local_m03 .mid_company_info a.more",
    ".jcinfo_logo a img",
    ".coNm",
    ".corp_name",
    "[class*='companyName']",
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const text = (el.attr("title") ?? el.text()).trim();
    if (text && text !== "인크루트") return text;
  }

  return "회사명 미확인";
}

function extractIframeText($: cheerio.CheerioAPI): string {
  $("script, style, noscript").remove();
  const body = $("body").first();
  if (!body.length) return cleanText($.root().text());
  return cleanText(body.text());
}

function extractIframeImages($: cheerio.CheerioAPI): string[] {
  const urls = new Set<string>();
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const normalized = src.startsWith("//") ? `https:${src}` : src;
    if (!INCRUIT_IMAGE_HOSTS.some((h) => normalized.includes(h))) return;
    if (IMAGE_EXCLUDE_PATTERNS.some((p) => p.test(normalized))) return;
    urls.add(normalized);
  });
  return Array.from(urls);
}

/**
 * 메인 HTML (og:title/회사명) + iframe HTML (본문)을 조합해 CrawlResult 생성.
 * 실제 공고 본문은 대부분 이미지로 올라와서 OCR 트리거가 되는 경우가 많음.
 */
export function parseIncruitHtml(
  mainHtml: string,
  iframeHtml: string,
  sourceUrl: string,
  contentUrl: string,
): IncruitParseResult | null {
  const $main = cheerio.load(mainHtml);
  const $iframe = cheerio.load(iframeHtml);

  const title = extractTitleFromMain($main);
  const company = extractCompanyFromMain($main);
  const text = extractIframeText($iframe);
  const imageUrls = extractIframeImages($iframe);

  if (!text && imageUrls.length === 0) return null;

  const needsVisionOcr = text.length < MIN_TEXT_LEN_FOR_NO_OCR && imageUrls.length > 0;

  return {
    result: { title, company, text, url: sourceUrl },
    imageUrls,
    needsVisionOcr,
    contentUrl,
  };
}
