import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";

export const SARAMIN_IMAGE_HOSTS = [
  "saraminimage.co.kr",
  "www.saraminimage.co.kr",
];

const MIN_TEXT_LEN_FOR_NO_OCR = 300;

const IMAGE_EXCLUDE_PATTERNS = [
  /\/sri\//,
  /bbs_recruit2\/blue_[0-9]+_bene/,
  /watermark/,
  /ai_pass/,
  /img_graphic/,
  /loading\.gif/,
  /logo_/,
];

export interface SaraminParseResult {
  result: CrawlResult;
  imageUrls: string[];
  needsVisionOcr: boolean;
}

export function normalizeSaraminUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith("saramin.co.kr")) return null;

  const recIdx = parsed.searchParams.get("rec_idx");
  if (!recIdx || !/^\d+$/.test(recIdx)) return null;

  const path = parsed.pathname;
  const isJobView =
    path === "/zf_user/jobs/view" ||
    path === "/zf_user/jobs/relay/view" ||
    path === "/job-search/view";
  if (!isJobView) return null;

  return `https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=${recIdx}`;
}

function cleanText(text: string): string {
  return text
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitle($: cheerio.CheerioAPI): string {
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) return ogTitle.replace(/\s*-\s*사람인\s*$/, "").trim();
  const titleTag = $("title").text().trim();
  if (titleTag) return titleTag.replace(/\s*-\s*사람인\s*$/, "").trim();
  return $("h1").first().text().trim() || "제목 없음";
}

function parseCompanyFromTitle(rawTitle: string): string | null {
  const title = rawTitle.replace(/\s*-\s*사람인\s*$/, "").trim();
  if (!title) return null;

  // "[회사명] {직무}" — 사람인 og:title에서 자주 등장
  const bracket = title.match(/^\[\s*([^\]]+?)\s*\]/);
  if (bracket?.[1]) {
    const candidate = bracket[1].trim();
    if (candidate && candidate !== "사람인") return candidate;
  }

  // "{회사명} 채용 - {본문}" 패턴
  const beforeChaeyong = title.match(/^(.+?)\s+채용\s*[-–]/);
  if (beforeChaeyong?.[1]) {
    const candidate = beforeChaeyong[1].trim();
    if (candidate && candidate !== "사람인") return candidate;
  }

  return null;
}

function extractCompany($: cheerio.CheerioAPI): string {
  const candidates = [
    'meta[property="og:site_name"]',
    ".company_nm",
    ".corp_name",
    ".company-name",
    ".cp_nm",
    '[class*="company_nm"]',
  ];
  for (const sel of candidates) {
    const el = $(sel).first();
    const text = sel.startsWith("meta") ? el.attr("content")?.trim() : el.text().trim();
    if (text && text !== "사람인") return text;
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

function extractJdText($: cheerio.CheerioAPI): string {
  // 정밀 셀렉터 우선 — 요약 + 상세 섹션만 조합 (UI 노이즈 제거)
  const summary = $(".jv_summary").first();
  const detail = $(".jv_detail").first();
  if (summary.length || detail.length) {
    [summary, detail].forEach((el) =>
      el.find("script, style, iframe, noscript, button, .btn_area").remove(),
    );
    const parts: string[] = [];
    if (summary.length) {
      const t = cleanText(summary.text());
      if (t) parts.push(`[핵심 정보]\n${t}`);
    }
    if (detail.length) {
      const t = cleanText(detail.text());
      if (t) parts.push(`[상세 정보]\n${t}`);
    }
    const combined = parts.join("\n\n");
    if (combined.length >= 100) return combined;
  }

  // 폴백 — 넓은 컨테이너
  const fallbackSelectors = [".wrap_jv_cont", ".wrap_jview", ".user_content"];
  for (const sel of fallbackSelectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    el.find("script, style, iframe, noscript").remove();
    const text = cleanText(el.text());
    if (text.length >= 100) return text;
  }
  return "";
}

function extractJdImages($: cheerio.CheerioAPI): string[] {
  const urls = new Set<string>();
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const normalized = src.startsWith("//") ? `https:${src}` : src;
    if (!SARAMIN_IMAGE_HOSTS.some((h) => normalized.includes(h))) return;
    if (IMAGE_EXCLUDE_PATTERNS.some((p) => p.test(normalized))) return;
    urls.add(normalized);
  });
  return Array.from(urls);
}

export function parseSaraminHtml(
  html: string,
  url: string,
): SaraminParseResult | null {
  const $ = cheerio.load(html);

  const title = extractTitle($);
  const company = extractCompany($);
  const text = extractJdText($);
  const imageUrls = extractJdImages($);

  if (!text && imageUrls.length === 0) return null;

  const needsVisionOcr = text.length < MIN_TEXT_LEN_FOR_NO_OCR && imageUrls.length > 0;

  return {
    result: { title, company, text, url },
    imageUrls,
    needsVisionOcr,
  };
}
