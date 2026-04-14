/**
 * Next.js Route Handler용 SSE 유틸.
 *
 * AsyncIterable을 ReadableStream으로 변환하여 SSE 응답 생성.
 */

const encoder = new TextEncoder();

export function createSSEStream<T>(
  generator: AsyncIterable<T>,
  signal?: AbortSignal,
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          if (signal?.aborted) break;
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "알 수 없는 오류";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}

export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
