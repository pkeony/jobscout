import { NextResponse } from "next/server";
import { CrawlRequestSchema } from "@/types";
import { crawlJobDescription, CrawlError } from "@/lib/crawl/crawler";

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
    return NextResponse.json(result);
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
