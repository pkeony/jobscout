# JobScout — AI 채용공고 분석기

## 개요
JD URL을 넣으면 AI가 스킬 추출 → 프로필 매칭 → 자소서 초안 → 면접 예상질문 제공

## 규칙
- **스택:** Next.js 15 (App Router), TypeScript strict (`any` 금지), Tailwind v4
- **UI:** shadcn/ui + Framer Motion
- **LLM:** Gemini 2.5 Flash (`@google/generative-ai`)
- LLM SDK import는 `src/lib/ai/` 내부에서만
- 커밋 메시지 한국어 본문, 영어 식별자
- 사용자 자체 API Key 모드 — 키를 서버에 저장하지 않음

## 구조
```
src/
├── app/          ← 페이지 + API Routes
├── components/   ← shadcn/ui + 도메인 컴포넌트 + motion 래퍼
├── hooks/        ← useStreamingResponse 등
├── lib/ai/       ← Gemini 게이트웨이 (stream, pricing, types)
├── lib/prompts/  ← 기능별 시스템 프롬프트
├── lib/crawl/    ← URL → JD 텍스트 크롤링
└── types/        ← 도메인 타입
```
