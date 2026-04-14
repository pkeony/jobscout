# JD 분석 파이프라인 설계

## 개요

URL 또는 텍스트 입력 → 크롤링 → Gemini 분석 → 구조화 결과 표시.
프로젝트의 핵심 기능이자 나머지 3개 기능(매칭, 자소서, 면접)의 기반.

## 파이프라인 구성요소

### 1. 크롤러 (`src/lib/crawl/crawler.ts`)

**역할:** URL → JD 텍스트 추출

```
fetchHtml(url) → cheerio.load(html) → extract(title, company, body) → CrawlResult
```

- generic 파서: article → main → body 순서로 본문 탐색
- 사이트별 파서(Phase 2): 원티드, 사람인, 점핏 전용 DOM 셀렉터
- 방어: SSRF 차단, 10초 타임아웃, 1MB 크기 제한

### 2. 분석 프롬프트 (`src/lib/prompts/analyze.ts`)

**역할:** JD 텍스트 → 분석용 메시지 생성

- 시스템 프롬프트에 JSON 스키마를 명시하여 구조화 출력 유도
- 한국어 JD 패턴 매핑 규칙 포함 (자격요건→required, 우대사항→preferred)
- temperature 0.1 (분석 작업이므로 창의성 최소화)

### 3. SSE 스트리밍 (`src/app/api/analyze/route.ts`)

**역할:** Gemini 스트림 → SSE 이벤트 전달

```
stream(apiKey, messages, opts) → createSSEStream(generator) → sseResponse(stream)
```

- delta 이벤트로 실시간 토큰 전달
- done 이벤트에 usage(토큰 수, 비용) 포함

### 4. JSON 추출 (`extractJson()`)

**역할:** 스트리밍 완료 후 fullText → AnalysisResult

- 마크다운 코드블록 자동 제거
- Zod 스키마 검증
- 파싱 실패 시 원문 fallback 표시

## 에러 처리 전략

| 단계 | 에러 | 대응 |
|------|------|------|
| 크롤링 | 사이트 차단/타임아웃 | "텍스트 직접 입력" 안내 |
| API Key | 누락/무효 | 400 + 에러 메시지 |
| Gemini | API 에러 | SSE error 이벤트 |
| JSON 파싱 | 불완전 응답 | 원문 fallback |

## 확장 지점

- 사이트별 파서 추가 → `src/lib/crawl/parsers/`
- 분석 프롬프트 개선 → `src/lib/prompts/analyze.ts`
- 분석 결과 캐싱 → Phase 2 (DB 도입 후)
