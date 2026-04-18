import type { MatchResult } from "@/types";
import type { MatchExpected, MatchRuleScore } from "../types";

/**
 * rule-based 평가자 (match target).
 * schemaValidity 는 caller 가 파싱 성공 여부로 세팅.
 */
export function evaluateMatchRules(
  result: MatchResult,
  expected: MatchExpected,
): Omit<MatchRuleScore, "schemaValidity"> {
  const [lo, hi] = expected.scoreRange;
  const scoreInRange = result.score >= lo && result.score <= hi;

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

  const mustMatchHits = expected.mustMatch.filter((name) =>
    result.skillMatches.some(
      (m) =>
        m.status === "match" &&
        m.name.toLowerCase().includes(name.toLowerCase()),
    ),
  ).length;
  const mustMatchTotal = expected.mustMatch.length;

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

export function summarizeMatchRules(rules: MatchRuleScore): string {
  const parts = [
    `schema=${rules.schemaValidity ? "✓" : "✗"}`,
    `range=${rules.scoreInRange ? "✓" : "✗"}`,
    `sanity=${rules.scoreSanity ? "✓" : "✗"}`,
    `mustMatch=${rules.mustMatchHits}/${rules.mustMatchTotal}`,
    `gapViol=${rules.mustNotGapViolations}`,
  ];
  return parts.join(" ");
}
