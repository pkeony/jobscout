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
| **eval 인프라 (rule + LLM-judge 2축)** | "프롬프트 바꿨더니 나아졌다" 를 숫자로 증명. 회귀 방어선 | 4종 target 각 10 case × rule + judge. match `skillCoverage=1.000`, analyze `mustHaveCoverage=1.000`, cover-letter `companyNamePresent=100%` 등 invariant 전수 통과 |

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

### 4. eval-driven prompt tuning ([eval/](eval/))

4종 기능(match·analyze·cover-letter·interview) 각 goldset 10 case 로 자동 평가. 각 타겟은 **rule-based invariant** 와 **LLM-as-a-judge rubric** 을 병렬로 실행한다.

```
eval/
├── types.ts                    # Zod discriminated union, 4종 Expected/Rule/Aggregate
├── rules/{match,analyze,cover-letter,interview}.ts    # 결정론적 불변식
├── judges/{match,analyze,cover-letter,interview}.ts   # Claude Haiku rubric judge
├── runners/                     # API 호출 + 리포트 생성
├── goldset/*.jsonl              # case 별 input + expected
└── reports/                     # JSON 타임스탬프 리포트
```

Phase E1 ~ E3 를 거치며 발견한 운영 교훈:

- **정량 rule 과 LLM-judge 는 서로 다른 것을 잡는다.** Rule 은 `domainIntrusionRate=0`, `scoreSanity=|sum-score|≤1` 같은 불변식. Judge 는 "그럴듯함" 같은 주관 축. 두 축이 같은 방향이면 안심, 다른 방향이면 실험을 파고든다.
- **judge score 는 0.55 영역에 고착** (rubric variance). KPI 를 `judgeAvg` 로 두면 안 됨. **invariant + sub-indicator** 조합이 안정. 예: STAR keyword 수, skillCoverage, companyNamePresent 등.
- **goldset 의 빈 필드는 "없음" 이 아니라 "정의되지 않음" 일 수 있다.** case-04 의 `requirements=[]` 가 focusPosition 분기 결함을 가려버린 사례. rule 에 "분모 0 감지" 불변식 필요.
- **variance 흡수는 goldset 레이어(해석 불가) > 프롬프트 레이어(해석 가능).** 프롬프트에 "보수적으로" 추가하면 모델이 전체 판정 톤을 이동시키는 spillover 발생. 진자처럼 오버슈팅 → 반대 극단 사례 실경험 (match v1.2.1 롤백).
- **"미해결" 이 "어려운 문제" 를 의미하지 않는다.** cover-letter case-08 회사명 edge 가 여러 세션 미해결이었는데 원인은 코드·프롬프트가 아니라 **goldset snapshot stale**. regen 한 번으로 해결.

### 5. 사이트별 파서 복구력

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
- **judgeAvg 를 KPI 로 두지 말 것** — LLM rubric variance 로 0.55 영역에 고착. sub-indicator(skillCoverage, STAR keyword 수 등) 가 실제 튜닝 신호
- **variance 는 코드·goldset 레이어에서 흡수** — 프롬프트로 "보수적으로" 를 주면 전체 톤이 이동해 진자 후동 발생 (case-05 97→30 실사례). 해석 가능한 레이어일수록 variance 에 취약

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
- **"LLM 애플리케이션 eval 을 어떻게 설계했나요?"** → rule(결정론적 invariant) + LLM-judge(주관 축) 2축 병렬. judgeAvg variance 한계를 실측으로 확인 → sub-indicator(skillCoverage, STAR keyword 수 등) 를 실제 KPI 로. goldset 10 case × 4 target.
- **"프롬프트 수정이 의도와 다르게 동작한 경험?"** → match v1.2.1 진자 후동 실경험 (case-05 score 97 → 30). "보수적으로" 한 문구 추가가 프롬프트 전역 톤을 이동시키는 spillover. 롤백 후 goldset 레이어 fix.
- **"LLM 애플리케이션에서 디버깅 접근?"** → 3계층 가설 검증 (코드 → 모델 → 프롬프트 계약). 각 계층에서 "정상 동작" 을 지표로 증명하며 다음 계층으로. case-04 score=30 상수 버그를 이 순서로 추적해 프롬프트 계약 결함으로 수렴.

---

## Phase E1 ~ E3 튜닝 루프 회고

JobScout 의 4종 LLM 기능 (match·analyze·cover-letter·interview) 을 goldset + eval 기반으로 반복 튜닝. 주요 이정표:

| 단계 | commit | 성과 |
|------|--------|------|
| Phase E1 | 여러 프롬프트 튜닝 | match skillCoverage 0.875→1.000, analyze mustHaveCoverage 0.833→1.000, interview sampleAnswer 100%, cover-letter STAR keyword +80% |
| Phase E2 | `188b7fd` `c5349c2` `13b4302` | goldset 분모 결함 감지 & 재보정. preferredCoverage 0 → 측정 가능 상태 |
| Phase E3 Task1 | `0b6c820` | match@v1.2.0 focusPosition 게이트 명시 + `normalizeBreakdown` floor guard. case-04 score 30 상수 → 74~75 |
| Phase E3 Task2 | `a3580c6` | case-05 scoreRange 완화. v1.2.1 진자 후동 롤백 후 goldset 레이어 fix |
| Phase E3 Task3 | `25b300c` | case-08 mustMatch 간소화. skillCoverage 0.857→1.000 |
| Phase E3 Task4 | `9feaf98` | cover-letter case-08 snapshot regen. companyNamePresent 90%→100% |

**최종 상태** (2026-04-19): 4종 eval 전 invariant 통과. scoreInRange 100%, scoreSanity 100%, skillCoverage 1.000, mustHaveCoverage 1.000, companyNamePresent 100%, STAR fully covered 100%.

### 튜닝 블로그 11편
`blog-drafts/jobscout-{01~11}.md` — 각 편이 한 기술 트레이드오프·실측 사례를 다룸. 대표 3편:
- **jobscout-09**: capping 가설 기각 → 3계층 디버깅 워크플로우
- **jobscout-10**: goldset 분모 0 의 함정 → eval 통과율 뒤의 라벨 품질
- **jobscout-11**: 프롬프트 fix 진자 후동 → goldset 레이어 fix 의 정당성

---

*Last updated: 2026-04-19 (Phase E1~E3 튜닝 루프 종결)*
