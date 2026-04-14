# SSE 스트리밍 아키텍처

## 개요

서버(Gemini) → SSE → 클라이언트 실시간 전달. 4개 핵심 기능(분석, 매칭, 자소서, 면접)이 모두 이 패턴을 공유.

## 서버사이드 (3개 레이어)

```
[stream.ts]          AsyncGenerator<StreamEvent>  — Gemini SDK 래핑
     ↓
[sse.ts]             createSSEStream()            — AsyncIterable → ReadableStream
     ↓
[route.ts]           sseResponse()                — ReadableStream → Response (SSE 헤더)
```

### stream.ts (`src/lib/ai/stream.ts`)
- `stream(apiKey, messages, opts)`: Gemini generateContentStream 호출
- yield `{ type: "delta", text }` — 텍스트 조각
- yield `{ type: "done", usage, model }` — 완료 + 토큰 사용량

### sse.ts (`src/lib/sse.ts`)
- `createSSEStream<T>(generator, signal)`: 이벤트를 `data: {json}\n\n` 형식으로 인코딩
- 에러 발생 시 `{ type: "error", message }` 이벤트 전송 후 스트림 종료
- abort 신호 처리

### route.ts (각 API Route)
- `sseResponse(stream)`: Content-Type: text/event-stream 헤더 설정

## 클라이언트사이드

### useStreamingResponse (`src/hooks/use-streaming-response.ts`)

```
start(body) → fetch(POST, SSE) → SSE 프레임 파싱 → dispatch(CHUNK/DONE/ERROR)
```

- 상태: idle → streaming → done | error
- `chunks[]`: 모든 이벤트 배열
- `fullText`: delta.text 누적 문자열
- `stop()`: AbortController로 중단
- `reset()`: 초기화

## 새 SSE 엔드포인트 추가 방법

1. `src/lib/prompts/` 에 시스템 프롬프트 + 메시지 빌더 작성
2. `src/app/api/{name}/route.ts` 에 Route Handler 작성
3. 클라이언트에서 `useStreamingResponse("/api/{name}")` 사용

stream() + createSSEStream() + sseResponse() 3개 조합은 동일.
