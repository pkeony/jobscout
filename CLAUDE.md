# JobScout — AI 채용공고 분석기

> 상세 아키텍처는 [ARCHITECTURE.md](ARCHITECTURE.md), 전체 지식맵은 [AGENTS.md](AGENTS.md) 참조.

## 규칙

### 스택
- **프레임워크:** Next.js 15 (App Router)
- **언어:** TypeScript strict (`any` 금지)
- **스타일:** Tailwind CSS v4 (OKLCH 색상)
- **UI:** shadcn/ui (Base-UI 기반) + Framer Motion
- **LLM:** Gemini 2.5 Flash (`@google/generative-ai`)
- **크롤링:** cheerio
- **검증:** Zod v4

### 코드 경계
- LLM SDK import는 `src/lib/ai/` 내부에서만
- 시스템 프롬프트는 `src/lib/prompts/` 에서만 정의
- 도메인 타입은 `src/types/` 에서 Zod 스키마로 단일 정의
- SSE 유틸은 `src/lib/sse.ts` — 모든 스트리밍 API Route가 공유

### 보안 (상세: [SECURITY.md](SECURITY.md))
- 사용자 자체 API Key 모드 — 키를 서버에 저장하지 않음
- 크롤러 SSRF 방지 (private IP 차단)
- 모든 API 입력 Zod 검증 필수

### 커밋
- 한국어 본문, 영어 식별자
- `--no-verify` 금지
- 새 커밋 생성 (amend 지양)

### 금지
- `any` 타입
- LLM SDK를 `src/lib/ai/` 외부에서 import
- API Key를 서버에 저장/로깅
- 요청 외 리팩토링/주석/타입 추가
