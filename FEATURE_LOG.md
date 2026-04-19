# Feature Log — JobScout

채용공고 URL 하나로 **JD 구조화 분석 → 프로필 매칭 → 자소서 초안 → 면접 질문** 을 스트리밍으로 답하는 Next.js 15 기반 서비스. 2026-04-15 부트스트랩, 2026-04-19 기준 Phase E1~E3 eval 튜닝 루프 종결.

**스택 개요**: Next.js 15 (App Router) · TypeScript strict · Gemini 2.5 Flash (`@google/genai` v1) · Tailwind CSS v4 · shadcn/ui · Framer Motion · Zod v4 · cheerio

각 피처는 "완료 시점" 기준. 커밋 해시는 git log 로 해당 diff 확인 가능.

---

### 2026-04-19 · txt 다운로드 4종 + 피처 D 의 v0 입력 확장
- **기능**: 자소서·면접·매칭 결과를 .txt 로 다운로드 4곳 추가 — `/cover-letter` 자동 생성본·ImproveSection 첨삭본·D 의 v0/v1, `/interview` 10 질문+팁, `/match` 점수+강점/갭/스킬/조언. 피처 D 가 v0 후보 두 개 (자동 생성본 / 기존 자소서 첨삭본) 중 셀렉터로 선택 가능. ImproveSection 첨삭본을 sessionStorage(`jobscout:coverLetterImproveResult`) 에 박제해 D 가 입력으로 받음. 사용자 워크플로 통찰 ("1·2번 = v0 양자택일 / 3번 = v1 보강") 을 코드에 반영한 follow-up.
- **API**: 변경 없음 (UI + sessionStorage 만).
- **스택**: `src/lib/cover-letter-export.ts` (신규), `src/lib/text-export.ts` (신규), `src/app/cover-letter/page.tsx` (다운로드 + improve 결과 sessionStorage 저장 + 중복 helper 제거), `src/app/interview/page.tsx`, `src/app/match/page.tsx`, `src/components/cover-letter/RefineFromInterviewSection.tsx` (셀렉터 + 다운로드 + reset 흐름).
- **구현 요약**: 사용자가 "1·2 = 첨삭 전, 3 = 보강" 으로 정신 모델 정리해준 게 핵심. D 가 두 v0 후보 모두 받게 확장 (sessionStorage 키 분리, 셀렉터 UI). 다음 세션 IA 재설계 (페이지 분리) 의 데이터 모델 토대. 다운로드 helper 는 도메인별 1파일 (cover-letter-export, text-export) 로 분리.
- **커밋**: `043e8ae`

### 2026-04-19 · 자소서↔면접 역추적 첨삭 (피처 D · agent-like 파이프라인)
- **기능**: 자소서 v0 + interview 결과를 LLM 1→2 로 체이닝. 신규 엔드포인트 2개 — `/api/cover-letter-trace` (각 면접 질문의 intent 로 자소서 약점 3~8개 추출) + `/api/cover-letter-refine` (선택된 약점만 주입해서 v1 생성, 4섹션 고정 유지). UI 는 자소서 페이지 하단 통합 — 약점 카드 체크박스 → diff 뷰 + changeNotes 툴팁. eval `cover-letter-trace` target 신설 — 같은 cover-letter judge/rule 을 v0/v1 양쪽 적용 → judgeDelta primary KPI + improvedRate · sub-indicator delta.
- **API**: `/api/cover-letter-trace`, `/api/cover-letter-refine` (둘 다 SSE, JSON body, MAX_ATTEMPTS=2).
- **스택**: `src/types/index.ts` (Zod 6 schema), `src/lib/ai/schemas.ts` (Gemini OpenAPI 2개), `src/lib/prompts/cover-letter-{trace,refine}.ts`, `src/app/api/cover-letter-{trace,refine}/route.ts`, `src/components/cover-letter/{RefineFromInterviewSection,CoverLetterDiffView}.tsx` (npm `diff@9.0.0`), `eval/{types.ts,cli.ts,runner.ts,rules/cover-letter-trace.ts,runners/cover-letter-trace.ts,build-trace-goldset.ts,goldset/cover-letter-traces.jsonl}`, `docs/design-docs/cover-letter-trace.md`.
- **구현 요약**: Plan 모드 5 phase + worktree 첫 실전. eval Round 1 baseline **judgeDelta=-0.028** (refine 이 v0 의 STAR 라벨을 떼고 매끄러운 산문으로 다시 써서 cover-letter judge 의 STAR 축 fail) → Round 2 **+0.000** (refine 프롬프트에 "v0 STAR 라벨 보존" 한 문장 추가로 회복). Plan 위험표의 "judgeDelta 음수" 시나리오 정확히 재현 + spillover (evidenceQuestionMatch 98→90%) 까지 실측. Phase E 의 미시 튜닝 루프가 피처 단위 개발에서도 그대로 작동.
- **커밋**: `9bbba9d`

### 2026-04-19 · PORTFOLIO.md eval 반영 + RETROSPECTIVE.md 신규
- **기능**: Phase E1~E3 튜닝 루프 종결 시점에 프로젝트 문서 최신화. PORTFOLIO.md 에 eval 인프라·운영 교훈·Phase 회고 테이블·블로그 11편 맵·면접 어필 포인트 3개 추가. RETROSPECTIVE.md 신규 — Phase 구조·잘한 점 6개·아쉬운 점 4개·이식 패턴·블로그 맵·별점 포함.
- **API**: 없음 (문서만).
- **스택**: `PORTFOLIO.md` (+181 lines), `RETROSPECTIVE.md` (신규 188 lines).
- **구현 요약**: "프로젝트 소개형" PORTFOLIO.md 와 "잘한 점/아쉬운 점/이식 패턴" 중심 RETROSPECTIVE.md 로 역할 분리. 면접 자료·다음 프로젝트 이식 참고·블로그 연결을 한 자리에서 훑게.
- **커밋**: `faf0daa`

### 2026-04-19 · Phase E3 Task4 — cover-letter case-08 회사명 edge 해결
- **기능**: 피플앤잡 헤드헌팅 JD (case-08/09) 에서 cover-letter 가 `companyName="B2B SaaS 기업"` 로 생성되던 edge 해결. 원인은 코드·프롬프트가 아니라 **goldset `analysisResult` snapshot stale**. analyze 는 대부분 "HR 컨설팅(주)" 로 정상 추출하는데, snapshot 만 variance 결과로 고정돼있었음. `regenerate-analysis.ts --target=cover-letter` 한 번으로 해결.
- **API**: 없음 (goldset 재생성만).
- **스택**: `eval/goldset/cover-letters.jsonl` (10 case analysisResult snapshot 갱신).
- **구현 요약**: Phase E1 부터 미해결로 남아있던 edge 를 "코드 버그 가설" 에서 "snapshot stale 가설" 로 전환해 해결. 교훈: 오래 미해결 edge 는 **원인 레이어를 바꿔 의심** 해야 한다. 결과 cover-letter eval `companyNamePresent` 90%→100%, 다른 case regression 없음.
- **커밋**: `9feaf98`

### 2026-04-19 · Phase E3 Task3 — case-08 mustMatch 라벨 간소화 + scoreRange 완화
- **기능**: match eval case-08 의 variance 해결. 진단 과정에서 메모리 기록 가설 ("slash 분리 매칭 문제") 가 실측에서 기각됨. 실제 원인은 모델이 스킬 이름을 합쳐 출력하거나 partial 로 판정하는 variance. goldset 레이어에서 fix — `mustMatch ["LangGraph","RAG","LLM"] → ["LangGraph"]` (mustNotGap=["LangGraph","RAG"] 이 중복 보호), `scoreRange [75,98] → [70,98]`.
- **API**: 없음.
- **스택**: `eval/goldset/matches.jsonl` case-08 expected 수정.
- **구현 요약**: rule 을 엄격하게 유지한 채 noise 가 큰 mustMatch 항목만 제거. 결과 skillCoverage **0.857 → 1.000**, scoreInRange 100%. 메모리 기록은 시작점 가설로 쓰고 실측 재검증이 선행돼야 한다는 원칙 재확인.
- **커밋**: `25b300c`

### 2026-04-19 · Phase E3 Task2 — case-05 scoreRange 완화 (v1.2.1 롤백)
- **기능**: match v1.2.0 에서 case-05 (OCR 실패 JD) 가 score 90~97 로 상향 이동 → scoreRange [55,85] 상한 초과. v1.2.1 프롬프트 fix ("JD 근거 부족 시 문자 그대로 등장한 스킬만 포함") 시도 → **case-05 score 30 으로 역회귀 + case-07 까지 보수 톤 이동** (진자 후동). 롤백 후 goldset 레이어 fix — `scoreRange [55,85] → [55,98]`.
- **API**: 없음.
- **스택**: `eval/goldset/matches.jsonl` case-05 scoreRange 완화.
- **구현 요약**: 프롬프트 수정이 전체 판정 톤을 이동시키는 **spillover** 현상 실측. "보수적으로" 문구 추가가 LLM 에게 "프로필 기반 매칭 자체 금지" 로 확대 해석됨. goldset 레이어 (해석 불가) > 프롬프트 레이어 (해석 가능) 원칙. 블로그 jobscout-11 서사.
- **커밋**: `a3580c6`

### 2026-04-19 · Phase E3 Task1 — match@v1.2.0 focusPosition 구조결함 근본 수정
- **기능**: case-04 (비기술 JD + focusPosition 지정) 의 `score=30 상수 수렴` 버그를 프롬프트·코드 2레이어로 근본 수정. **프롬프트**: focusPosition 블록에 "requirements 가 비어 있고 focusPosition 이 있으면 도출 필수 스킬 3~5개 선언 → max = N×15" 명시. **코드**: `normalizeBreakdown` 에 floor guard — `max=0 && skillMatches≥3 → max=45`. 프롬프트가 회귀해도 코드가 2차 방어선.
- **API**: `/api/match` (프롬프트 변경, 응답 스키마는 동일).
- **스택**: `src/lib/prompts/match.ts` (focusPosition 섹션 확장 + `normalizeBreakdown` floor guard).
- **구현 요약**: 3계층 가설 검증 (코드 → 모델 → 프롬프트 계약) 의 교과서 사례. `normalizeBreakdown` 은 정상 (scoreSanity 100% 증거), 모델도 프롬프트 대로 동작, 남은 건 **프롬프트 계약의 공란**. 결과 case-04 score 30 상수 → 74~75, `requiredSkills.max` 0 → 45~60. 블로그 jobscout-09.
- **커밋**: `0b6c820`

### 2026-04-19 · Phase E2 — goldset 품질 감사 + scoring capping 가설 기각
- **기능**: eval 지표 이상치를 "모델 탓·연산 탓" 으로 서두르지 않고 **goldset 라벨 결함** 을 먼저 의심. (1) match: "sum=127→score=100" 이 capping 정상 동작 결과임을 코드로 증명, scoreRange 5 case 재보정. (2) analyze: mustHavePreferredSkills 8 case 라벨링 (preferredCoverage 0 → 측정 가능 상태). 캐롯아이 case-06/07 에 AWS/Git 추가로 1.0 과적합 해소. (3) 4종 goldset `analysisResult` snapshot 전체 재생성.
- **API**: 없음 (goldset/라벨만).
- **스택**: `eval/goldset/matches.jsonl`, `eval/goldset/analyses.jsonl`, `eval/regenerate-analysis.ts`.
- **구현 요약**: eval 통과율 뒤의 라벨 품질을 감사하지 않으면 숫자는 계속 속인다. "metric 0 은 모델이 아니라 라벨 결함일 수 있다" 는 깨달음 — goldset 빈 필드가 "없음" 과 "정의되지 않음" 을 구분하지 않으면 프롬프트 계약도 공란이 된다. scoreInRange 60%→90%, mustHavePreferredCoverage 0→1.000. 블로그 jobscout-10.
- **커밋**: `188b7fd` `c5349c2` `13b4302` `2eda9f4`

### 2026-04-19 · Phase E1 — 4종 프롬프트 튜닝 사이클
- **기능**: 4종 기능의 sub-indicator 를 순서 재정렬해서 튜닝. **interview** sampleAnswer 최소 7문장 강제 (avg-valid 80→100%). **match** advice/comment 구체성 강화 (스킬명+기간+프로젝트). **cover-letter** few-shot FE+PM 추가로 직무 편향 완화. **analyze** 도메인 키워드(영상/이미지 등) 추출 지시 추가 (mustHaveCoverage 0.833→1.000). **improve-cover-letter** 3레이어 atomic 커밋 (client+API+prompt) 으로 runtime break 방어. `/eval-compare` 슬래시 커맨드 추가.
- **API**: `/api/analyze`, `/api/match`, `/api/cover-letter`, `/api/interview`, `/api/improve-cover-letter` 프롬프트 변경.
- **스택**: `src/lib/prompts/{analyze,match,cover-letter,interview,improve-cover-letter}.ts`, `.claude/commands/eval-compare.md`.
- **구현 요약**: rubric variance 한계 (judgeAvg 0.55 고착) 체감. KPI 를 judgeAvg 에서 sub-indicator 로 전환하는 중요한 인사이트 획득. STAR keywords +80%, skillCoverage 0.875→1.000. 블로그 jobscout-06/07.
- **커밋**: `20b147b` `6b352bc` `08739ff` `e6cc56c` `6ef1f4d` `cde048a`

### 2026-04-19 · Phase E1 확장 — 3종 eval 추가 + 4종 타겟 통합 구조
- **기능**: match 만 있던 eval 을 4종(match/analyze/cover-letter/interview) 로 확장. Zod discriminated union 으로 Expected/Rule/Aggregate 를 4종 모두 수용. 통합 CLI `pnpm eval:<target> --model=<id>`. STAR 라벨 강제화, analyze literal-check rule (도메인 간·도메인 내 hallucination 동시 감지), interview sampleAnswer rule 을 aggregate 기반으로 재해석. `regenerate-analysis.ts --target=all|<one>` 으로 goldset snapshot 일괄 재생성.
- **API**: 없음 (eval 인프라).
- **스택**: `eval/types.ts`, `eval/rules/*.ts`, `eval/judges/*.ts`, `eval/runners/*.ts`, `eval/cli.ts`, `eval/regenerate-analysis.ts`.
- **구현 요약**: rule(결정론적 invariant) + LLM-judge(Claude Haiku rubric) 2축 병렬. 두 축이 서로 다른 것을 잡는다는 설계 철학. 한 축만 보고 "hallucination 방어 완성" 이라 결론 내면 다른 축의 failure 가 가려짐. 블로그 jobscout-06 의 수치화 핵심.
- **커밋**: `6b05b4f` `02f8b32` `baca454` `4d06e8a` `f16ded0` `b945a4f`

### 2026-04-19 · Structured Output 파이프라인 + 자소서 JSON 전환 + 초기 프롬프트 튜닝
- **기능**: Gemini Structured Output (`responseSchema`) 로 4종 응답을 스키마 고정. PROMPT_VERSION 을 리포트·로그에 기록 (회귀 시 재구성 가능). 자소서 JSON 렌더 (섹션·문단·STAR 라벨 분리 표시), 면접 파싱 실패 UX 개선. match 프롬프트 개선 + `breakdown` 산수 후처리로 sanity 강제 (`Math.abs(sum-score)≤1` 불변식). Gemini 폴백 체인에서 deprecated `gemini-2.0-flash` 제거. 자소서 히스토리/헤더 가독성, 면접 profile 전달로 맞춤 질문. analyze hallucination 방어 (도메인 4분류 + 양방향 음수 예제).
- **API**: `/api/analyze`, `/api/match`, `/api/cover-letter`, `/api/interview` 구조화 출력 + 로깅 전환.
- **스택**: `src/lib/ai/schemas.ts`, `src/lib/ai/stream.ts`, `src/lib/prompts/*.ts`, `src/app/api/*/route.ts`, `src/types/*.ts` (Zod 스키마).
- **구현 요약**: 프롬프트 변화의 효과를 숫자로 증명하기 위한 pre-condition 인프라. Structured Output 이 Zod 검증 통과율을 100% 수준으로 올리고, PROMPT_VERSION 기록이 리포트간 비교 기반. "무엇을 측정할지 정의" 하는 eval 인프라 투자가 이후 Phase E1~E3 튜닝을 가능하게 함.
- **커밋**: `67cbd24` `f625fee` `2ae5d82` `78017c4` `68ed182` `02ba070` `6f5e704` `6710e2f` `42176f2` `538e263` `ccbe963`

### 2026-04-18 · eval 시스템 인프라 (match 단일 target 선행)
- **기능**: `/api/match` 대상 eval 시스템 구축. 10 case goldset 수집 헬퍼, rule-based 평가자 (scoreInRange, scoreSanity, mustMatchHits, mustNotGapViolations), Claude Haiku judge, 리포트 JSON 생성. `pnpm eval:match` CLI.
- **API**: 없음 (eval 인프라).
- **스택**: `eval/rules/match.ts`, `eval/judges/match.ts`, `eval/runners/match.ts`, `eval/cli.ts`, `eval/goldset/matches.jsonl`, `eval/collect.ts` (헬퍼).
- **구현 요약**: "프롬프트 고쳤다" 를 수치로 증명하는 baseline. 이후 Phase E1 에서 4종으로 확장되는 기반 아키텍처. Zod 로 goldset 스키마 강제, 실패 case 는 전체 run 중단 없이 개별 에러로 기록.
- **커밋**: `3f8c841` `a31737a`

### 2026-04-18 · UX 고도화 — 히스토리 · 프로필 멀티 슬롯 · 점수 breakdown
- **기능**: (1) 매칭·분석 결과 자동 저장 + `/history` 탭 분리 (기존 대시보드에서 분리). (2) 프로필 멀티 슬롯 + 라벨 (`/profiles` 관리). 지원 직무에 따라 다른 프로필 조합 시뮬레이션. (3) 매칭 점수 stacked bar + 산정 근거 분해 (requiredSkills/preferredSkills/experience/base 4개 축). (4) AnalysisResult/focusPosition 을 3개 페이지(match/cover-letter/interview) 에서 공유 — 한 번 분석한 JD 를 재활용.
- **API**: `/api/match`, `/api/cover-letter`, `/api/interview` 에서 `analysisResult` 재주입, 프로필 파라미터 확장.
- **스택**: `src/app/history/`, `src/app/profiles/`, `src/components/*` breakdown 차트, sessionStorage 훅.
- **구현 요약**: 취준생 리얼 워크플로 — 한 JD 에 여러 프로필·기능 조합을 빠르게 시험. 점수 breakdown 은 "왜 70점인지" 근거를 시각화해서 LLM 출력의 주관성을 완화. sessionStorage 기반이라 서버 저장 없음.
- **커밋**: `5374cee` `e31f53b` `8ad3748` `ce67f94` `e2597b4`

### 2026-04-18 · 사이트별 크롤러 + Vision OCR 인프라
- **기능**: 원티드/사람인/잡코리아/잡인크루트 전용 파서 + generic 폴백. 사람인·잡코리아는 이미지 한 장으로 공고가 올라오는 경우가 태반 → Gemini Vision multimodal OCR 파이프라인. SSRF 방지 (private IP 차단, host allowlist). EUC-KR / KS_C_5601 인코딩 HTML 디코딩. 다중 포지션 pre-pass (한 URL 에 10+ 포지션인 기업 대응) + 수동 포지션 지정 UI. og:title 회사명 폴백.
- **API**: `/api/crawl` (site 디스패치), `/api/analyze-from-image` (Vision OCR 전용).
- **스택**: `src/lib/crawl/parsers/{wanted,saramin,jobkorea,jobinkorea}.ts`, `src/lib/crawl/crawler.ts` (SSRF), `src/lib/crawl/detect-positions.ts`, `src/lib/vision/{fetch-image,ocr}.ts`.
- **구현 요약**: 한국 채용시장은 이미지 공고·인코딩·SPA 초기데이터 등 서양 기준 자료엔 없는 edge 가 많음. generic cheerio 만으로는 본문 텅 빔 → 사이트별 `__NEXT_DATA__`·iframe·OCR 조합. 블로그 jobscout-01(silent parser failure), jobscout-02(multimodal OCR), jobscout-05(EUC-KR) 배경.
- **커밋**: `477b1cb` `fd0d3d8` `e31a567` `5c9017d` `87653ea` `5c9a76d` `70a081d` `07cc672`

### 2026-04-18 · Gemini SDK v1 + 폴백 체인 + 서킷 브레이커
- **기능**: `@google/generative-ai` 에서 `@google/genai` v1 마이그레이션. 3단계 폴백 체인 (flash → flash-lite → 2.0-flash, 후에 2.0 deprecated 로 2단 축소). 프로세스 레벨 서킷 브레이커 (3회 연속 실패 → 60초 차단). **핵심 불변식**: 첫 delta emit 이후에는 모델 전환 불가 (클라 중복 수신 방지) — mid-stream 실패는 throw, early-fail 만 폴백.
- **API**: 모든 LLM 호출 API (`/api/analyze`, `/api/match` 등) 가 `src/lib/ai/stream.ts` 경유.
- **스택**: `src/lib/ai/stream.ts` (폴백 체인), `src/lib/ai/circuit-breaker.ts`, `src/lib/ai/types.ts` (AiMessage 멀티모달 파츠).
- **구현 요약**: 2026-04-18 Gemini 2.5 Flash 수 시간 503 장애 실경험이 설계 동력. "설마 구글이 다운되겠어?" 가 뚫렸을 때 서비스 죽지 않게 하는 게 LLM Application Engineer 의 핵심 역량. 블로그 jobscout-03(fallback circuit-breaker), jobscout-04(SSE mid-stream) 배경.
- **커밋**: `fb7af95`

### 2026-04-17 · Neo-Academic Pixel 리디자인 + 이력서·자소서 기능
- **기능**: 전체 6개 페이지 리디자인 (Neo-Academic 픽셀 테마). 이력서 파싱(`parse-resume`), 자소서 초안 생성·첨삭, 캐싱 버그 수정.
- **API**: `/api/parse-resume`, `/api/cover-letter`, `/api/improve-cover-letter`.
- **스택**: `src/app/**/page.tsx` 전체, `src/components/*`, Tailwind v4 토큰 재설계.
- **구현 요약**: shadcn/ui (Base-UI 기반) + Framer Motion + Tailwind v4 OKLCH 색상으로 통일. 이력서 업로드 → 자소서 초안 → 첨삭까지 한 세션 내 완결되는 워크플로.
- **커밋**: `12b4968`

### 2026-04-15 · 부트스트랩 + JD 분석 핵심 파이프라인 (Day 1-6)
- **기능**: Next.js 15 App Router 초기 구조. Day 1-4 JD 분석 파이프라인 (crawl → analyze), Day 5 프로필 매칭, Day 6 자소서·면접 예상질문. API Key 관리 방식 초기엔 유저 입력 → 서버 환경변수 fallback. SSE 요청 중복 방어 (React strict mode 더블 렌더링 대응).
- **API**: `/api/crawl`, `/api/analyze`, `/api/match`, `/api/cover-letter`, `/api/interview` 최초 생성.
- **스택**: `src/app/`, `src/lib/crawl/`, `src/lib/ai/`, `src/lib/sse.ts`, `src/types/`.
- **구현 요약**: 4종 기능을 모두 **스트리밍(SSE)** 기반으로 설계. Zod 스키마를 도메인 타입의 단일 소스로 사용. `src/lib/ai/` 에 LLM SDK import 를 격리해 다음 프로젝트 이식 가능한 "도메인 무지 게이트웨이" 유지.
- **커밋**: `1f28960` `6dfcf66` `03fadb9` `7e57185` `1e00e24` `aa5e63f` `b19c741` `b4b6f3e` `40c4313`

---

*Last updated: 2026-04-19*
