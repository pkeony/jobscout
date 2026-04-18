# JobScout — AI 채용공고 분석기

> 채용공고 URL 하나 붙여넣으면 AI가 **JD를 구조화 분석 → 내 프로필과 매칭 → 자소서 초안 → 예상 면접 질문**까지 스트리밍으로 답한다.

**Stack:** Next.js 15 · TypeScript strict · Gemini 2.5 Flash (`@google/genai` v1) · Tailwind v4 · Framer Motion · Zod v4 · cheerio

---

## 왜 만들었는가

Forge(RAG) 이후 두 번째 포트폴리오 프로젝트. Forge가 "원리를 이해하고 직접 구현한다"를 증명하는 거였다면, JobScout는 **"LLM을 실제 서비스에 붙였을 때 발생하는 실전 운영 문제를 풀 수 있다"** 를 증명하는 게 목표.

구체적으로는:

1. **멀티모달 LLM** 실전 적용 (이미지 공고가 한국 채용시장에 너무 흔함)
2. **스트리밍 회복력** — 503 장애·중간 끊김에도 사용자 경험이 유지되는 설계
3. **BYOK(Bring Your Own Key)** — 서버 비용 0, 사용자 프라이버시 보장
4. **도메인 무지 AI 게이트웨이** — `src/lib/ai`를 다음 프로젝트(Nebula)에 그대로 재사용

---

## 어떤 문제를 푸는가

취준생의 리얼한 워크플로:
- 공고 10개 훑어보면서 "나랑 맞나?" 빠르게 판단하고 싶다
- 자소서 초안이라도 있으면 시작이 쉽다
- 면접 예상 질문도 공고 기반으로 미리 보고 싶다

기존 ATS 서비스는 대부분 **기업 입장(지원자 스크리닝)**. JobScout는 **지원자 입장**에서 공고를 뜯어본다.

---

## 아키텍처

```
[브라우저]                 [Next.js App Router — Vercel]
 └─ sessionStorage    ──→   /api/crawl       → cheerio 파서 (원티드/사람인/잡코리아/generic)
                                              └─ 이미지 공고 감지 → Vision OCR (Gemini multimodal)
                                              └─ pre-pass: 포지션 리스트 감지 (LLM)

                            /api/analyze     ─┐
                            /api/match        ├─→ src/lib/ai/stream.ts
                            /api/cover-letter ├─   ├─ 폴백 체인: flash → flash-lite → 2.0-flash
                            /api/interview    ┘   ├─ 서킷 브레이커 (3회 실패 → 60초 차단)
                                                  └─ bufferedFallback (JSON route 안정성)
                                              └─→ SSE (ReadableStream)
```

### 디렉토리 (경계가 강제된)

```
src/
├── app/
│   ├── analyze|match|cover-letter|interview/page.tsx   # 기능별 페이지
│   └── api/{crawl,analyze,analyze-from-image,match,cover-letter,interview,parse-resume,improve-cover-letter}/route.ts
├── lib/
│   ├── ai/           # Gemini 게이트웨이 — 외부에서 SDK import 금지
│   │   ├── stream.ts           # 폴백 체인 + 재시도 + bufferedFallback
│   │   ├── circuit-breaker.ts  # 프로세스 레벨 브레이커
│   │   ├── pricing.ts          # 모델별 토큰 단가 계산
│   │   └── types.ts            # AiMessage(멀티모달 파츠), ChatOptions, StreamEvent
│   ├── prompts/      # 기능별 시스템 프롬프트 — 도메인 로직은 여기만
│   ├── crawl/
│   │   ├── crawler.ts          # SSRF 방지 + 사이트 디스패치
│   │   ├── detect-positions.ts # 다중 포지션 pre-pass
│   │   └── parsers/            # wanted/saramin/jobkorea 전용 파서
│   ├── vision/
│   │   ├── fetch-image.ts      # 이미지 다운로드 + 크기 검증
│   │   └── ocr.ts              # Gemini multimodal OCR
│   └── sse.ts        # SSE ReadableStream 유틸
└── types/            # Zod 스키마가 도메인 타입의 단일 소스
```

---

## 핵심 기술 결정

| 결정 | 왜 | 결과 |
|------|------|------|
| **BYOK (사용자 자체 API Key)** | 운영 비용 0, 키 서버 저장·로깅 금지로 프라이버시 | 배포 즉시 사용 가능, Vercel 무료 티어로 충분 |
| **Gemini Vision OCR** (전용 OCR 대신) | 한국어 공고 이미지 품질이 Tesseract·Naver OCR 대비 압도적. 이미지 포지션/스킬/복지를 컨텍스트째 이해 | 사람인/잡코리아 이미지 공고 대응 |
| **3단계 폴백 체인** (flash → flash-lite → 2.0-flash) | 2026-04-18 Gemini 2.5 Flash 수 시간 503 장애 실경험 — single point of failure 제거 | 장애 중에도 서비스 유지 |
| **서킷 브레이커** | 폴백 체인도 실패하면 모든 요청이 타임아웃까지 대기 → UX 최악 | 3회 연속 실패 → 60초 차단, 즉시 사용자에게 안내 |
| **mid-stream vs early-fail 분리** | SSE 중간 실패는 클라가 일부만 파싱 → "깨진 JSON" 상태로 방치됨 | JSON route는 `bufferedFallback: true`로 서버 buffer 후 일괄 emit |
| **pre-pass로 다중 포지션 감지** | 큰 기업은 한 URL에 10+개 포지션(헤이딜러 15개, 컷백 등) → 전부 분석하면 품질 뭉개짐 | LLM call 1회로 포지션 리스트 추출 → 사용자 선택 후 focusPosition으로 집중 분석 |
| **사이트별 전문 파서 (wanted/saramin/jobkorea)** | generic cheerio는 SPA(원티드)에선 핵심 필드 누락, 이미지 많은 잡코리아는 본문 비어있음 | 사이트별 초기데이터(`__NEXT_DATA__`) · iframe · OCR 조합으로 정보 누락 최소화 |
| **`src/lib/ai` 도메인 무지 분리** | CLAUDE.md에 "LLM SDK import는 `src/lib/ai/` 내부에서만" 규칙으로 박음 | 다음 프로젝트(Nebula)로 그대로 이식 가능 |
| **Zod = 타입 소스** | API 경계 검증과 타입 단일 소스 | 런타임 안전 + 정적 타입 동시 달성 |

---

## 구현 하이라이트

### 1. Gemini 폴백 체인 + 서킷 브레이커 ([stream.ts](src/lib/ai/stream.ts))

```ts
const FALLBACK_CHAIN: readonly ModelId[] = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

// 핵심 불변식: 첫 delta 이후에는 모델 전환 불가 (클라 중복 수신 방지)
for (const model of models) {
  try {
    for await (const event of streamSingleModel(...)) {
      if (event.type === "delta") yieldedAnyForModel = true;
      yield event;
    }
    breaker.recordSuccess();
    return;
  } catch (err) {
    if (yieldedAnyForModel) throw err;  // mid-stream 실패 → 폴백 불가
    // 조기 실패만 다음 모델로 폴백
  }
}
```

운영 중 경험한 실제 로그:
```
[Gemini] 폴백 체인 시작: [gemini-2.5-flash → gemini-2.5-flash-lite]
[Gemini] (1/2) gemini-2.5-flash 시도
[Gemini:gemini-2.5-flash] 재시도 1/4 ... 4/4 모두 실패
[Gemini] gemini-2.5-flash 조기 실패 → 다음 모델(gemini-2.5-flash-lite)로 폴백
[Gemini] (2/2) gemini-2.5-flash-lite 시도
[Gemini] gemini-2.5-flash-lite 성공 ✓
```

> 참고: 초기 폴백 체인에는 `gemini-2.0-flash`가 있었으나, 2026-04 기준 Google이 해당 ID를 deprecate(404)하여 제거. eval로 flash-lite가 judge 기준 오히려 더 높음(0.644 vs 0.565)을 확인 후 단순 2단 체인으로 정리.

### 2. Vision OCR 파이프라인 ([vision/ocr.ts](src/lib/vision/ocr.ts))

사람인·잡코리아는 채용공고 본문이 **이미지 한 장**으로 올라오는 경우가 태반. 해결:

1. 파서가 이미지 URL 수집 (사이트별 host allowlist, 로고·광고 제외 패턴)
2. `fetch-image.ts`에서 이미지 병렬 다운로드 + 크기 검증 (SSRF 방지)
3. `@google/genai` multimodal API로 inline image parts 전송 → Gemini가 텍스트로 변환
4. OCR 결과를 원본 텍스트와 병합해서 `/api/analyze`로 흘려보냄

트레이드오프: Tesseract / Naver OCR 대비 2~3배 비싼 대신, **구조화 이해**(표 레이아웃, 아이콘 맥락 등)가 가능.

### 3. 다중 포지션 자동 감지 + 수동 개입

대기업 공고는 한 URL에 여러 파트/지역/직무가 한꺼번에 나열되는 경우가 많음 (헤이딜러 실측 15개 파트). 해결:

1. 크롤 직후 **pre-pass LLM call** 1회로 `positions: string[]` 추출
2. `positions.length`에 따라 분기:
   - `1개` → 그대로 분석
   - `2개+` → 피커 UI + "직접 입력" 필드
   - `0개 (감지 실패)` → "자동 감지 안 됐어요" 안내 + 직접 입력만
3. 선택된 포지션은 `focusPosition`으로 분석 프롬프트에 주입 → JD 안에서 해당 역할만 추출해 집중 분석

### 4. 사이트별 파서 복구력

- **원티드**: SPA(Next.js) → HTML body 대신 `__NEXT_DATA__` JSON 파싱. `hire_rounds`가 문자열/배열 둘 다 올 수 있어 union type + 정규화 함수
- **잡코리아**: 본문이 `GI_Read_Comt_Ifrm` iframe에 있음 → iframe HTML 직접 fetch + body 텍스트 + 이미지 OCR. `og:title`에서 `"{회사명} 채용 -"` 패턴으로 회사명 폴백 추출
- **사람인**: `.jv_summary` + `.jv_detail` 정밀 셀렉터 우선, 실패 시 `.wrap_jv_cont` 등 넓은 폴백

---

## 배포

- **Vercel** — Next.js App Router 기본
- **환경변수** — `GOOGLE_API_KEY` 서버 fallback(데모용). 실제 사용자는 브라우저에서 자기 키 입력 → 서버는 in-memory만, 저장·로깅 안 함
- **SSE** — Vercel Edge Runtime 호환 (fetch ReadableStream)

---

## 배운 것 · 다음 프로젝트로

### 정성적 회고

- **`catch {}` 는 디버깅 블랙홀** — 초기 버전에서 크롤러 파서가 silent fail(`hire_rounds`가 string인데 `.map`) 해서 LLM 프롬프트만 계속 고치다 하루 버림. 이 경험이 파이프라인 역추적 습관으로 고착 → 블로그 1편으로 정리
- **LLM 장애는 상수가 아니다** — 운영 중 Gemini 2.5 Flash 503이 수 시간 지속. 직관적으론 "설마 구글이 다운되겠어?" 싶지만, 실제 장애를 겪고 폴백·브레이커를 설계하는 경험이 LLM Application Engineer의 핵심 역량이라 생각
- **멀티모달은 OCR 대체재가 아니라 확장** — 단순 텍스트 추출을 넘어 "이 이미지가 뭘 의미하나"까지 LLM이 해석. 표 레이아웃·아이콘 컨텍스트 등 전통 OCR로는 못 얻는 정보

### Nebula(다음 프로젝트) 로 이식할 요소

- `src/lib/ai/` — 폴백 체인 + 서킷 브레이커 + 멀티모달 파츠 (그대로)
- `src/lib/sse.ts` — ReadableStream 기반 SSE 유틸
- Zod 단일 소스 원칙

---

## 면접 어필 포인트

- **"LLM API 장애 났을 때 어떻게 했어요?"** → 폴백 체인 + 서킷 브레이커 + mid-stream vs early-fail 분리 설계 실경험
- **"멀티모달 어떻게 써봤어요?"** → 이미지 공고를 Gemini Vision으로 OCR하는 실제 파이프라인, Tesseract 대비 트레이드오프
- **"스트리밍 중간에 끊기면?"** → SSE는 파싱 중간 실패가 "조용히" 발생 → `bufferedFallback` + 클라 자동 재시도로 대응
- **"도메인 로직과 인프라 분리?"** → CLAUDE.md에 "LLM SDK import는 `src/lib/ai/` 내부에서만" 규칙을 박아서 다음 프로젝트에 그대로 재사용 가능한 게이트웨이 유지
- **"BYOK 구현 시 주의점?"** → API Key 서버 저장·로깅 금지, SSRF 방지 크롤러(private IP 차단), Zod 경계 검증

---

*Last updated: 2026-04-18*
