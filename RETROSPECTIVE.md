# 회고 — JobScout (AI 채용공고 분석기)

> 기간: 2026-04 초 ~ 2026-04-19 (튜닝 루프 종결 시점 기준)
> 결과물: Next.js 15 기반 JobScout 서비스 + 4종 eval 인프라 + 블로그 11편
> 기술: Next.js 15 · Gemini 2.5 Flash · Tailwind v4 · Zod v4 · cheerio
> 특기: BYOK · 멀티모달 OCR · SSE 폴백 체인 · eval-driven prompt tuning

---

## 🎯 한 줄 요약

**"LLM 을 실서비스에 붙였을 때 발생하는 운영 문제(장애 폴백·멀티모달·스트리밍 회복·프롬프트 튜닝)를 전 구간 직접 해결한 프로젝트."** Forge 가 "원리 이해" 였다면 JobScout 은 "실전 운영" 축을 증명.

---

## 📐 Phase 구조

| 페이즈 | 주요 내용 | 결과물 |
|--------|-----------|--------|
| Phase A~C | 크롤러·UI·LLM 파이프라인 구축 | 4종 기능(analyze·match·cover-letter·interview) |
| Phase D | 장애 대응 인프라 — 폴백 체인, 서킷 브레이커, bufferedFallback | 실제 Gemini 503 장애에서 서비스 유지 |
| **Phase E1** | eval 인프라 (rule + judge 2축) + 초기 goldset | 4종 target × 10 case, baseline 측정 가능 |
| **Phase E2** | goldset 품질 감사 + scoring capping 가설 기각 | scoreInRange 60%→90%, preferredCoverage 0→1.0 |
| **Phase E3** | 구조 결함 근본 수정 4건 | 4종 eval 전 invariant 100% 통과 |

---

## ✅ 잘한 점

### 1. eval 인프라를 "rule + LLM-judge 2축" 으로 설계
한 축만 보면 다른 축의 failure 가 가려진다는 실측. `domainIntrusionRate=0%` 같은 결정론적 invariant 와 Claude Haiku judge 의 rubric score 를 병렬로 봄. 면접에서 "LLM eval 어떻게 설계했나" 질문의 답변 재료.

### 2. judgeAvg 를 KPI 로 쫓지 않은 판단
초기엔 judgeAvg 0.525 → 0.712 같은 변화를 쫓으려 했지만 실측으로 **rubric variance 한계** 를 확인 (같은 출력도 ±0.1 변동). sub-indicator (skillCoverage, STAR keyword 수, companyNamePresent 등) 로 KPI 를 옮겨 튜닝 신호가 안정화.

### 3. 3계층 디버깅 워크플로우 체득
case-04 score=30 상수 버그를 "코드 → 모델 → 프롬프트 계약" 순서로 추적. 각 계층에서 정상 동작을 지표로 증명하며 다음으로 넘어감. 성급한 코드 수정을 참을 수 있게 해주는 습관 (블로그 jobscout-09).

### 4. variance 흡수 레이어 선택 원칙 확립
v1.2.1 프롬프트 fix 가 case-05 97→30 진자 후동을 낸 실경험으로, **"해석 가능한 레이어(프롬프트)" 보다 "해석 불가능한 레이어(goldset·코드)" 가 variance 흡수에 안전** 하다는 원칙을 실증. 이후 Task2/3/4 전부 goldset 레이어 fix.

### 5. 블로그로 기록 — 11편 축적
Phase 중 실측 사례를 블로그 초안으로 곧장 기록. 11편 전부 본문 완성. 기술 블로그 + 면접 재료 + 다음 세션 맥락 기록 3가지 역할.

### 6. 메모리 시스템 활용
`MEMORY.md` + 개별 파일로 세션간 맥락 유지. 실측 재검증 패턴 (`feedback_llm_sanity.md`, `feedback_prompt_spillover.md`, `feedback_goldset_regen.md`) 을 쌓아 같은 실수 반복 방지.

---

## ⚠️ 아쉬운 점

### 1. 진자 후동을 한 번 겪어야 교훈을 배웠다
v1.2.1 의 `"문자 그대로 등장한 스킬만"` 문구 추가가 전체 판정 톤을 보수 쪽으로 이동시킨 spillover. 실패한 뒤에야 "프롬프트 레이어의 해석 유연성" 을 실감. 블로그 jobscout-11 로 정리했지만, 같은 함정을 다음 프로젝트에서 반복하지 않으려면 **튜닝 계획 단계에서 레이어 선택 기준을 미리 명시** 하는 게 더 낫다.

### 2. goldset snapshot stale 체감에 여러 세션 걸림
cover-letter case-08 회사명 edge 가 Phase E1 부터 기록된 미해결 edge 였는데, 원인이 코드·프롬프트가 아닌 **goldset snapshot 의 variance 고착** 이라는 걸 오늘에야 알아냄. 한 세션에 한 문제 깊게 파는 전략이 snapshot 층위 의심을 늦추는 부작용을 만들었다.

### 3. "미해결" 을 "어려운 문제" 로 착각
원인 가설 레이어를 한 번 바꿔보는 판단이 늦었다. edge case 가 오래 남았을 때 시간 대비 어려움을 재평가하는 점검 루틴이 필요.

### 4. 초기 메모리 기록이 가설이라는 걸 모르고 사실처럼 다룸
이번 옵션 B 진행 시 메모리 기록 "slash 분리 매칭 문제" 를 정답처럼 시작했다가 실측에서 기각. 메모리는 **시작점 가설** 로 쓰고, 실측 재검증이 선행돼야 한다는 룰이 이번 세션에서 자리잡음.

---

## 🛠️ 다른 프로젝트로 이식할 패턴

### 설계 패턴
- **rule + LLM-judge 2축 eval** — `eval/rules/*.ts` + `eval/judges/*.ts` 구조. 4종 target × 10 case 스케일.
- **Zod discriminated union 으로 eval Expected/Rule/Aggregate 통합** — `eval/types.ts`.
- **PROMPT_VERSION 을 리포트에 기록** — 회귀 시 "어느 버전에서 왜 달라졌나" 재구성 가능.
- **goldset 의 `analysisResult` snapshot + `regenerate-analysis.ts`** — 프롬프트 변경 시 stale 을 일괄 갱신.

### 판단 패턴
- **3계층 디버깅**: 출력 → runtime → 프롬프트 계약. 각 계층 정상 동작을 **지표로** 증명하고 다음으로.
- **variance 흡수 레이어 선택**: goldset(분해 불가) > 코드 후처리 > 프롬프트(해석 가능) 순서로 우선.
- **sub-indicator KPI**: judgeAvg 대신 invariant + sub-indicator 조합.
- **snapshot stale 의심**: "오래 미해결" = 원인 레이어가 다를 가능성.

### 문서화 패턴
- **PORTFOLIO.md · RETROSPECTIVE.md 병행**: PORTFOLIO 는 what(보여주기), RETROSPECTIVE 는 why/교훈(내부).
- **블로그 초안 → 본문 2단계**: Phase 중 초안 (훅+개요+핵심 claim), 소강 시점에 본문 확장. 이번 09/10/11 이 검증된 템플릿.

---

## 🎤 면접 어필 포인트

- **"LLM eval 설계"** → rule 결정론 축 + LLM-judge 주관 축 2축 병렬. judgeAvg variance 한계 실측 → sub-indicator KPI 전환. goldset 10 case × 4 target × PROMPT_VERSION 기록.
- **"프롬프트 수정이 의도와 다르게 동작한 경험"** → case-05 진자 후동 (97→30). spillover 현상. 롤백 + goldset 레이어 fix.
- **"LLM 애플리케이션 디버깅 접근"** → 3계층 가설 검증. case-04 상수 수렴을 프롬프트 계약 결함으로 수렴.
- **"LLM API 장애"** → Gemini 503 수 시간 장애 실경험. 폴백 체인 + 서킷 브레이커 + mid-stream/early-fail 분리.
- **"멀티모달 실전"** → 이미지 공고 Gemini Vision OCR 파이프라인. Tesseract 대비 트레이드오프.
- **"BYOK 구현"** → 키 서버 비저장·비로깅, SSRF 방지 크롤러, Zod 경계 검증.

---

## 📚 블로그 11편 맵

| # | 제목 | 각도 |
|---|------|------|
| 01 | silent parser failure | `catch {}` + 파이프라인 역추적 |
| 02 | multimodal vision OCR | Gemini Vision 실전 |
| 03 | Gemini fallback + circuit breaker | 503 장애 대응 |
| 04 | SSE mid-stream buffered fallback | 스트리밍 회복력 |
| 05 | EUC-KR silent cheerio bug | 인코딩 edge |
| 06 | eval-driven prompt tuning | hallucination 방어 수치화 |
| 07 | judge rubric variance tradeoff | rubric 유리천장 + sub-indicator |
| 08 | invariant 3-layer defense | Zod + rule + judge 3층 방어 |
| **09** | scoring capping rejected hypothesis | 3계층 디버깅 워크플로우 |
| **10** | goldset denominator zero trap | eval pass 뒤 라벨 품질 감사 |
| **11** | pendulum overcorrection | 프롬프트 진자 후동 실패 사례 |

---

## 🏆 포트폴리오 관점 별점

| 항목 | 점수 | 코멘트 |
|-----|------|------|
| LLM 실전 운영 | ⭐⭐⭐⭐⭐ | 장애 폴백·서킷·멀티모달·스트리밍 전 구간 직접 설계 |
| eval 설계 깊이 | ⭐⭐⭐⭐⭐ | rule+judge 2축, invariant+sub-indicator, goldset 품질 감사까지 |
| 트레이드오프 기록 | ⭐⭐⭐⭐⭐ | DECISION.md 수준 근거 + 블로그 11편 |
| 실패 사례 기록 | ⭐⭐⭐⭐⭐ | v1.2.1 진자 후동·snapshot stale 전부 블로그화 |
| 배포 완성도 | ⭐⭐⭐ | 현재 로컬 dev. Vercel 배포는 다음 단계 |
| 블로그화 | ⭐⭐⭐⭐⭐ | 11편 본문 완성 |

**총평: AI Application Engineer 타겟팅에 가장 직결되는 프로젝트. Forge(RAG 원리) + JobScout(운영·튜닝) 로 두 축이 채워진 상태.**

---

*작성일: 2026-04-19 (Phase E1~E3 튜닝 루프 종결 시점)*
