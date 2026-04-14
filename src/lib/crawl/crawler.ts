import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";

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

export async function crawlJobDescription(url: string): Promise<CrawlResult> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

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
