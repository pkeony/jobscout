---
description: 특정 target 의 최근 2개 eval 리포트를 비교해 전후 수치 diff + variance/improvement 분류 출력
argument-hint: <target> (match | analyze | cover-letter | interview)
---

# /eval-compare — Eval 리포트 전후 대조

target: `$ARGUMENTS`

`eval/reports/` 에서 `*-$ARGUMENTS-*.json` 패턴의 최근 2개 리포트를 찾아 `aggregate` 필드를 비교하고,
각 지표 변화를 아래 규칙으로 분류해 요약 표로 출력하라.

## 실행 단계

1. **파일 탐색**: `Bash` 로 `ls -t /home/pkeony/Kelvin/jobscout/eval/reports/*-$ARGUMENTS-*.json | head -2`
   - 결과가 2개 미만이면 "비교 불가 — 이전 리포트 없음" 출력 후 종료
2. **두 리포트 읽기**: `Read` 로 각 JSON 의 `promptVersion` + `aggregate` + `startedAt` 추출 (cases 배열은 무시해 컨텍스트 절약)
3. **diff 계산 + 분류**:
   - 지표별로 `before → after (delta)` 계산
   - 아래 분류 규칙 적용:
     - **✅ improvement**: invariant 지표(schemaValidity, sanity, mustNotGap, categoryDistExact 등 "위반율/충족률") 가 상향
     - **✅ improvement**: sub-indicator(skillCoverage, starKeywords, avgValid 등) 가 +5%p 이상 상향
     - **⚠️ variance**: judgeAvg 가 ±0.03 이내 (rubric variance 한계 — 0.55 고착 이슈)
     - **🔴 regression**: invariant 가 하향 / sub-indicator 가 -5%p 이상 하향
     - **🟡 neutral**: 나머지 (variance 범위 내 미세 변화)
4. **출력 형식** (markdown 표):
   ```
   ## /eval-compare $ARGUMENTS

   **before**: run_<ts> · promptVersion · started
   **after** : run_<ts> · promptVersion · started

   | 지표 | before | after | delta | 분류 |
   |---|---|---|---|---|
   | schemaValidity | 1.000 | 1.000 | ±0 | ✅ invariant |
   | judgeAvg | 0.687 | 0.677 | -0.010 | ⚠️ variance |
   | skillCoverage | 0.875 | 1.000 | +0.125 | ✅ improvement |
   ...

   ### 총평
   (1~2문장: 주요 improvement + 주요 regression 있으면 강조)
   ```

## 제약
- `cases` 배열은 읽지 마라 (토큰 낭비)
- 2개 리포트의 `promptVersion` 이 동일하면 "같은 프롬프트 variance 측정" 으로 명시
- 숫자는 소수점 3자리까지
