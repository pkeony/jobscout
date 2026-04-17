import { NextResponse } from "next/server";
import { CrawlRequestSchema } from "@/types";
import { crawlJobDescription, CrawlError } from "@/lib/crawl/crawler";
import { SARAMIN_IMAGE_HOSTS } from "@/lib/crawl/parsers/saramin";
import { JOBKOREA_IMAGE_HOSTS } from "@/lib/crawl/parsers/jobkorea";
import { fetchImageAsBase64, type FetchedImage } from "@/lib/vision/fetch-image";
import { ocrImagesToText } from "@/lib/vision/ocr";
import { detectPositions } from "@/lib/crawl/detect-positions";

const MAX_VISION_IMAGES = 5;
const ALLOWED_IMAGE_HOSTS = [...SARAMIN_IMAGE_HOSTS, ...JOBKOREA_IMAGE_HOSTS];

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const parsed = CrawlRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "유효한 URL을 입력해주세요" },
        { status: 400 },
      );
    }

    const result = await crawlJobDescription(parsed.data.url);
    const apiKey = process.env.GOOGLE_API_KEY;

    console.log(
      `[crawl] url=${parsed.data.url} text=${result.text.length}자 images=${result.imageUrls?.length ?? 0} apiKey=${apiKey ? "ok" : "missing"}`,
    );

    // JD 이미지가 있으면 항상 OCR — 실제 포지션 표·자격요건이 이미지 안에만 있는 케이스 대응
    // (원티드 파서는 imageUrls를 채우지 않으므로 영향 없음. 사람인/잡코리아 파서만 OCR 트리거)
    if (apiKey && result.imageUrls && result.imageUrls.length > 0) {
      const ocrText = await runVisionOcr(apiKey, result.imageUrls);
      console.log(`[crawl] OCR 결과 ${ocrText.length}자`);
      if (ocrText) {
        result.text = result.text
          ? `${result.text}\n\n[이미지에서 추출된 내용]\n${ocrText}`
          : ocrText;
      }
    }

    // 포지션 감지 (pre-pass)
    let positions: string[] = [];
    if (apiKey && result.text.length >= 50) {
      positions = await detectPositions(apiKey, result.text);
      console.log(`[crawl] positions 감지 ${positions.length}개: ${positions.slice(0, 5).join(" | ")}`);
    } else {
      console.log(`[crawl] positions 감지 스킵 (text=${result.text.length}자)`);
    }

    const { imageUrls: _u, needsVisionOcr: _o, ...publicResult } = result;
    void _u; void _o;
    return NextResponse.json({ ...publicResult, positions });
  } catch (err) {
    if (err instanceof CrawlError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }

    return NextResponse.json(
      { error: "크롤링 중 오류가 발생했습니다. 텍스트를 직접 붙여넣어 주세요." },
      { status: 500 },
    );
  }
}

async function runVisionOcr(apiKey: string, urls: string[]): Promise<string> {
  const targets = urls.slice(0, MAX_VISION_IMAGES);
  const images: FetchedImage[] = [];
  for (const url of targets) {
    try {
      const img = await fetchImageAsBase64(url, {
        allowedHosts: ALLOWED_IMAGE_HOSTS,
      });
      images.push(img);
    } catch (err) {
      console.warn("[crawl/ocr] 이미지 다운로드 실패:", url, err instanceof Error ? err.message : err);
    }
  }
  if (images.length === 0) return "";

  try {
    const { text } = await ocrImagesToText(apiKey, images);
    return text;
  } catch (err) {
    console.warn("[crawl/ocr] Vision OCR 실패:", err instanceof Error ? err.message : err);
    return "";
  }
}
