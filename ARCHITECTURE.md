# JobScout 아키텍처

## 시스템 개요

Next.js 풀스택 앱. 단일 파이프라인: **입력(URL/텍스트) → 크롤링 → LLM 분석 → 결과 표시**.
DB 없이 MVP — 상태는 sessionStorage/localStorage로 관리.

## 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript strict |
| LLM | Gemini 2.5 Flash (`@google/generative-ai`) |
| UI | shadcn/ui (Base-UI 기반) + Framer Motion |
| 스타일 | Tailwind CSS v4 (OKLCH 색상) |
| 크롤링 | cheerio |
| 검증 | Zod v4 |
| 마크다운 | react-markdown |
| 배포 | Vercel |

## 디렉토리 구조

```
src/
├── app/                    # 페이지 + API Routes
│   ├── page.tsx            # 홈 — URL/텍스트 입력
│   ├── analyze/page.tsx    # 분석 결과 표시
│   └── api/
│       ├── crawl/route.ts  # POST — URL → JD 텍스트 (REST)
│       └── analyze/route.ts # POST — JD → 분석 (SSE 스트리밍)
├── components/
│   ├── ui/                 # shadcn/ui (10개: Button, Card, Badge, Input, Textarea, Tabs, Progress, Skeleton, Separator, Tooltip)
│   ├── motion/             # Framer Motion 래퍼 (FadeIn, StaggerList)
│   └── providers.tsx       # ThemeProvider + TooltipProvider
├── hooks/
│   └── use-streaming-response.ts  # SSE 스트리밍 훅 (범용)
├── lib/
│   ├── ai/                 # Gemini 게이트웨이 (stream, pricing, types)
│   ├── prompts/            # 기능별 시스템 프롬프트
│   ├── crawl/              # cheerio 기반 JD 크롤러
│   ├── sse.ts              # SSE ReadableStream 유틸
│   └── utils.ts            # cn() 등 공통 유틸
└── types/                  # Zod 스키마 + 도메인 타입
```

## 데이터 흐름

```
[홈 page.tsx]
  │
  ├─ URL → POST /api/crawl → cheerio 파싱 → CrawlResult
  │  또는
  ├─ 텍스트 직접 입력
  │
  ▼ sessionStorage에 jdText 저장
  │
[/analyze page.tsx]
  │
  ├─ useStreamingResponse → POST /api/analyze (SSE)
  │     ├─ stream() (Gemini) → delta 이벤트
  │     └─ done 이벤트 (usage 포함)
  │
  ▼ extractJson(fullText) → AnalysisResult
  │
  └─ 구조화 카드 UI (스킬 뱃지, 요약, 회사정보 등)
```

## 핵심 설계 결정

| 결정 | 이유 |
|------|------|
| 사용자 자체 API Key | 운영 비용 0원, rate limit 분산 |
| sessionStorage 데이터 전달 | DB 없이 페이지 간 데이터 공유 |
| SSE 스트리밍 | 실시간 응답, Vercel 서버리스 호환 |
| Zod 스키마 = 타입 | 런타임 검증과 정적 타입 단일 소스 |
| generic 크롤러 먼저 | 사이트별 파서는 Phase 2 |
