import type { MatchResult } from "@/types";
import type { GoldsetCase, RuleScore } from "./types";

/**
 * rule-based 평가자.
 * schemaValidity는 caller가 파싱 성공 여부로 세팅 (여기선 result가 null 아니라는 것으로 true 간주).
 */
export function evaluateRules(
  result: MatchResult,
  expected: GoldsetCase["expected"],
): Omit<RuleScore, "schemaValidity"> {
  const [lo, hi] = expected.scoreRange;
  const scoreInRange = result.score >= lo && result.score <= hi;

  // scoreSanity: scoreBreakdown 합이 score와 일치하는가
  let scoreSanity = true;
  if (result.scoreBreakdown) {
    const sb = result.scoreBreakdown;
    const sum =
      sb.requiredSkills.earned +
      sb.preferredSkills.earned +
      sb.experience.earned +
      sb.base;
    scoreSanity = Math.abs(sum - result.score) <= 1 || result.score === 100;
  }

  // mustMatch: 지정 스킬이 match status로 잡혔나 (대소문자 무시, 부분 일치)
  const mustMatchHits = expected.mustMatch.filter((name) =>
    result.skillMatches.some(
      (m) =>
        m.status === "match" &&
        m.name.toLowerCase().includes(name.toLowerCase()),
    ),
  ).length;
  const mustMatchTotal = expected.mustMatch.length;

  // mustNotGap: 지정 스킬이 gap으로 떨어지면 위반
  const mustNotGapViolations = expected.mustNotGap.filter((name) =>
    result.skillMatches.some(
      (m) =>
        m.status === "gap" &&
        m.name.toLowerCase().includes(name.toLowerCase()),
    ),
  ).length;

  return {
    scoreInRange,
    scoreSanity,
    mustMatchHits,
    mustMatchTotal,
    mustNotGapViolations,
  };
}

export function summarizeRules(rules: RuleScore): string {
  const parts = [
    `schema=${rules.schemaValidity ? "✓" : "✗"}`,
    `range=${rules.scoreInRange ? "✓" : "✗"}`,
    `sanity=${rules.scoreSanity ? "✓" : "✗"}`,
    `mustMatch=${rules.mustMatchHits}/${rules.mustMatchTotal}`,
    `gapViol=${rules.mustNotGapViolations}`,
  ];
  return parts.join(" ");
}
