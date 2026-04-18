import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";

export const JOBKOREA_IMAGE_HOSTS = [
  "file.jobkorea.co.kr",
  "file1.jobkorea.co.kr",
  "file2.jobkorea.co.kr",
  "file3.jobkorea.co.kr",
  "www.jobkorea.co.kr",
];

const MIN_TEXT_LEN_FOR_NO_OCR = 300;

const IMAGE_EXCLUDE_PATTERNS = [
  /logo/,
  /btn_/,
  /icon_/,
  /loading\.gif/,
  /watermark/,
  /_ad_/,
];

export interface JobkoreaParseResult {
  result: CrawlResult;
  imageUrls: string[];
  needsVisionOcr: boolean;
  contentUrl: string;
}

/**
 * 잡코리아 URL에서 Gno(공고 ID) 추출.
 * 지원 패턴:
 *  - /Recruit/GI_Read/{Gno}
 *  - /recruit/gi_read/{Gno}
 *  - 쿼리로 ?Gno={Gno} 직접 지정
 */
export function normalizeJobkoreaUrl(url: string): { contentUrl: string; gno: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith("jobkorea.co.kr")) return null;

  const pathMatch = parsed.pathname.match(/\/Recruit\/GI_Read\/(\d+)/i);
  const queryGno = parsed.searchParams.get("Gno");
  const gno = pathMatch?.[1] ?? (queryGno && /^\d+$/.test(queryGno) ? queryGno : null);

  if (!gno) return null;

  return {
    contentUrl: `https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=${gno}`,
    gno,
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
  if (ogTitle) return ogTitle.replace(/\s*\|\s*잡코리아\s*$/, "").trim();
  const titleTag = $("title").text().trim();
  return titleTag.replace(/\s*\|\s*잡코리아\s*$/, "").trim() || "제목 없음";
}

function parseCompanyFromTitle(rawTitle: string): string | null {
  const title = rawTitle.replace(/\s*\|\s*잡코리아\s*$/, "").trim();
  if (!title) return null;

  // "{회사명} 채용 - {본문}" — 잡코리아 og:title 표준 포맷
  const beforeChaeyong = title.match(/^(.+?)\s+채용\s*[-–]/);
  if (beforeChaeyong?.[1]) {
    const candidate = beforeChaeyong[1].trim();
    if (candidate && candidate !== "잡코리아") return candidate;
  }

  // "[회사명] {직무}" — 일부 공고
  const bracket = title.match(/^\[\s*([^\]]+?)\s*\]/);
  if (bracket?.[1]) {
    const candidate = bracket[1].trim();
    if (candidate && candidate !== "잡코리아") return candidate;
  }

  return null;
}

function extractCompanyFromMain($: cheerio.CheerioAPI): string {
  const candidates = [
    'meta[property="og:site_name"]',
    ".coNm",
    ".corpName",
    "[class*='companyName']",
    ".tplCorpNm",
  ];
  for (const sel of candidates) {
    const el = $(sel).first();
    const text = sel.startsWith("meta") ? el.attr("content")?.trim() : el.text().trim();
    if (text && text !== "잡코리아") return text;
  }

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) {
    const fromOg = parseCompanyFromTitle(ogTitle);
    if (fromOg) return fromOg;
  }
  const titleTag = $("title").text().trim();
  if (titleTag) {
    const fromTitle = parseCompanyFromTitle(titleTag);
    if (fromTitle) return fromTitle;
  }

  return "회사명 미확인";
}

function extractIframeText($: cheerio.CheerioAPI): string {
  // iframe HTML 자체가 JD 본문인 경우가 많음 — 전체 body 텍스트 추출
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
    if (!JOBKOREA_IMAGE_HOSTS.some((h) => normalized.includes(h))) return;
    if (IMAGE_EXCLUDE_PATTERNS.some((p) => p.test(normalized))) return;
    urls.add(normalized);
  });
  return Array.from(urls);
}

/**
 * iframe HTML에서 파싱.
 * mainHtml은 메인 페이지(og:title, company 추출용). iframeHtml은 실제 JD 본문.
 */
export function parseJobkoreaHtml(
  mainHtml: string,
  iframeHtml: string,
  sourceUrl: string,
  contentUrl: string,
): JobkoreaParseResult | null {
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
