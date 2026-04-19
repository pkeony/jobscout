# 자소서↔면접 역추적 첨삭 (Feature D)

자소서 v0 와 채용공고 기반 예상 면접 질문 10개를 함께 LLM 에 던져 **면접 질문이 드러내는 자소서의 약점** 을 추출하고, 약점만 보강한 자소서 v1 을 생성한다. v0 vs v1 을 같은 cover-letter rule/judge 로 채점해 개선 폭을 수치화한다.

> Phase E1~E3 가 종결된 직후 (2026-04-19) 의 다음 피처. 기존 2개 API (`/api/improve-cover-letter` + `/api/interview`) 를 LLM 1→LLM 2 로 체이닝하는 첫 **agent-like 파이프라인** — 다음 프로젝트(Nebula) 의 agent loop 워밍업.

---

## 데이터 흐름

```
자소서 v0 + interview 결과 (sessionStorage 보존)
 │
 ├─→ POST /api/cover-letter-trace
 │     [LLM 1] Gemini 2.5 Flash · structured output
 │     · 면접 질문 10개의 intent → 자소서 약점 매핑
 │     · 출력: weaknesses[3..8] + overallDiagnosis
 │     · 약점 카드는 사용자가 체크박스로 검토·선택
 │
 ├─→ POST /api/cover-letter-refine
 │     [LLM 2] Gemini 2.5 Flash · structured output
 │     · 선택된 약점 리스트 + v0 → v1 생성 (4섹션 고정)
 │     · 출력: revised + appliedWeaknessIds + changeNotes[]
 │
 └─→ 자소서 페이지: CoverLetterDiffView
       · 4섹션 매칭 (heading 단위, 첫 4자 fuzzy fallback)
       · 문단 단위 diffWordsWithSpace (npm `diff@9.0.0`)
       · changeNotes 호버 시 weakness summary 툴팁

eval/cover-letter-trace
 ├─ trace 자체: weaknessCountInRange, evidenceQuestionMatchRate, evidenceLinkRate, relatedHeadingValidRate
 ├─ refine 자체: schemaValidity, appliedWeaknessRate, changeNotesPerWeakness
 └─ 같은 cover-letter rule/judge 를 v0/v1 양쪽에 적용 → judgeDelta(primary), improvedRate, headingsCoverageDelta, starLabelCountDelta
```

---

## 설계 결정 요약

| # | 결정 | 채택 | 이유 |
|---|------|------|------|
| Q1 | API 구조 | **신규 엔드포인트 2개 분리** (`trace` + `refine`) | (1) Nebula agent loop 워밍업 의도와 정합 (2) 사용자가 약점 검토 후 refine 트리거 (3) eval 분리 채점 (4) SSE 2단계 진행 표시 자연스러움 |
| Q2 | UX 진입점 | **자소서 페이지 통합** (`ImproveSection` 아래 `RefineFromInterviewSection`) | 첨삭 카드 패턴 + diff 뷰 컨테이너 재사용. 면접 페이지에서는 보조 링크만 (옵션) |
| Q3 | eval primary KPI | `judgeDelta = avg(judge_v1) − avg(judge_v0)` + `improvedRate(>+0.10)`, `headingsCoverageDelta`, `starLabelCountDelta` | judge 가 변화 폭 가장 잘 잡음. v0 정적 박제 + judge_v0 매 실행 → LLM noise 통제 |
| Q4 | 약점 주입 방식 | **약점 리스트 텍스트 + `relatedHeading?` optional** | 문단 인덱스 매핑은 v1 의 새 sections 와 무관해져서 의미 없음. heading 단위가 정밀도/단순성 균형 |
| Q5 | SSE 진행 표시 | Q1 분리 결과 자동 2단계 ("약점 분석" → "자소서 보강") | Q1 채택의 부산물 |

---

## Critical Files

### 신규
- `src/app/api/cover-letter-trace/route.ts` — JSON body, MAX_ATTEMPTS=2, temperature 0.1→0.0, normalize → schema.parse → SSE
- `src/app/api/cover-letter-refine/route.ts` — 동일 패턴, normalize 가 inputWeaknessIds 받아 정합성 강제
- `src/lib/prompts/cover-letter-trace.ts` — `COVER_LETTER_TRACE_SYSTEM_PROMPT` + buildXxxMessages + extractXxxJson + normalizeXxx + `PROMPT_VERSION = "cover-letter-trace@v1.0.0-2026-04-19"`
- `src/lib/prompts/cover-letter-refine.ts` — 4섹션 고정 규칙은 `improve-cover-letter.ts` 카피, normalize 가 sections.length=4 강제 + 누락 fallback
- `src/components/cover-letter/RefineFromInterviewSection.tsx` — 2 단계 흐름 + 약점 카드 체크박스
- `src/components/cover-letter/CoverLetterDiffView.tsx` — npm `diff` 의 `diffWordsWithSpace`, 4섹션 fuzzy match
- `eval/runners/cover-letter-trace.ts` — trace + refine + v0/v1 cover-letter rule + v0/v1 judge 체인
- `eval/rules/cover-letter-trace.ts` — `evaluateTraceRules`, `evaluateRefineRules`, `summarizeCoverLetterTraceRules`
- `eval/goldset/cover-letter-traces.jsonl` — 5~10 case (별도 작업 필요), v0 정적 박제

### 수정
- `src/types/index.ts` — `CoverLetterWeaknessSchema`, `CoverLetterTraceResultSchema`, `CoverLetterTraceRequestSchema`, `CoverLetterRefineRequestSchema`, `CoverLetterRefineResultSchema`, `CoverLetterChangeNoteSchema` 추가
- `src/lib/ai/schemas.ts` — `COVER_LETTER_TRACE_RESPONSE_SCHEMA`, `COVER_LETTER_REFINE_RESPONSE_SCHEMA` (Gemini OpenAPI, `minItems: "3"` 문자열)
- `src/app/cover-letter/page.tsx` — `<RefineFromInterviewSection />` 마운트
- `eval/types.ts` — `CoverLetterTraceExpected/GoldsetCase/RuleScore/CaseReport/Aggregate/EvalReport` 추가, discriminated union 확장
- `eval/cli.ts`, `eval/runner.ts` — target dispatcher 등록
- `package.json` — `diff` 의존성 + `eval:cover-letter-trace` script

### 재활용 (수정 없음)
- `src/lib/ai/stream.ts` `streamToJson` (폴백 체인 + 서킷 브레이커)
- `src/lib/sse.ts` `createSSEStream`, `sseResponse`
- `src/lib/prompts/_shared.ts` 컨텍스트 빌더
- `src/hooks/use-streaming-response.ts` SSE 클라이언트
- `eval/judges/cover-letter.ts` `judgeCoverLetter` (cover-letter goldset 형태로 어댑팅 호출)
- `eval/rules/cover-letter.ts` `evaluateCoverLetterRules` (v0/v1 양쪽 적용)

---

## eval delta metric 정의

각 case 당 LLM 호출 4회 (Gemini 2 + Haiku 2):
1. trace (Gemini Flash, structured output)
2. refine (Gemini Flash, structured output)
3. v0 judge (Claude Haiku, cover-letter judge 그대로)
4. v1 judge (Claude Haiku)

10 case 기준 총 40 호출, case 당 ~15초 가정 → 총 2~3분.

**v0 정적 박제 이유:** v0 가 매번 LLM 으로 생성되면 같은 case 의 약점 분포가 흔들려 trace/refine 평가가 noise. 박제하면 reproducibility 보장 + 비용 절감.

**v0 judge 매 실행 이유:** judge 자체에 variance 있음. v0/v1 을 같은 run 안에서 채점해야 delta 가 LLM noise 흡수.

**Aggregate KPI 우선순위:**
1. **`judgeDelta`** — 보강이 실제로 자소서 품질을 올렸는가 (primary). 음수면 trace/refine 프롬프트 튜닝 1라운드.
2. `improvedRate(>+0.10)` — 의미있는 개선이 일어난 case 비율
3. `headingsCoverageDelta`, `starLabelCountDelta`, `starLabelFullyCoveredDelta` — sub-indicator delta (보강 방향 감지)

---

## 위험·주의

| 위험 | 방어 |
|------|------|
| LLM hallucination — 약점이 자소서와 무관 | trace 프롬프트 "summary 는 자소서에 실제 등장하는 표현·주장에 한정" + rule `evidenceLinkRate` (weakness.summary 의 단어 ≥40% 가 v0 텍스트와 overlap) |
| 약점이 임의 면접 질문 인용 | rule `evidenceQuestionMatchRate` — weakness.evidenceQuestion 이 입력 interview.questions[].question 와 정확 매칭 |
| schema drift — `intent` vs `rationale` 표기 혼동 | 신규 prompt 모두 `intent` 로 통일 |
| sessionStorage 누락 | RefineFromInterviewSection disabled + CTA 링크 (`/interview` 로 이동) |
| v1 4섹션 규칙 위반 | `normalizeCoverLetterRefine` 가 sections.length=4 강제, heading 누락 시 fallback |
| diff 뷰 heading drift | `findSectionByHeading` 의 첫 4자 fuzzy fallback |
| eval `judgeDelta` 음수 (보강이 점수 낮춤) | trace 프롬프트 "약점 추출 정확도" + refine 프롬프트 "원문 강점 보존" 강조 (1라운드 튜닝) |
| `judgeCoverLetter` 가 cover-letter goldset 형태 요구 | 어댑터 obj 로 호출 (`adaptedCase: CoverLetterGoldsetCase`) |

---

## 다음 작업 (별도 세션)

- **goldset 5~10 case 작성** — 기존 `cover-letters.jsonl` / `interviews.jsonl` 의 매칭되는 case 로 합성. v0 는 cover-letter eval 1회 실행 결과를 박제.
- **eval 1라운드 실행 + KPI 확인** — `pnpm eval:cover-letter-trace`. judgeDelta 양수 확인.
- **블로그 글감** — "agent-like 파이프라인 첫 구현 — 약점 추출 → refine 체이닝 + delta 수치화" (jobscout-12 후보)
- **Feature I (음성 면접)** — `git worktree add ../jobscout-feat-i -b feat/voice-interview` 로 별도 worktree
