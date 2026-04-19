import type {
  CoverLetterRefineResult,
  CoverLetterResult,
  CoverLetterTraceResult,
  InterviewResult,
} from "@/types";
import type {
  CoverLetterTraceExpected,
  CoverLetterTraceRuleScore,
} from "../types";

const ALLOWED_HEADINGS = new Set([
  "지원 동기",
  "핵심 역량",
  "성장 경험",
  "입사 후 포부",
]);

export interface TraceRuleCoreScore {
  weaknessCount: number;
  weaknessCountInRange: boolean;
  evidenceQuestionMatchRate: number;
  evidenceLinkRate: number;
  relatedHeadingValidRate: number;
}

export interface RefineRuleCoreScore {
  appliedWeaknessRate: number;
  changeNotesPerWeakness: number;
}

function v0AllText(v0: CoverLetterResult): string {
  return v0.sections
    .flatMap((s) => s.paragraphs)
    .join("\n")
    .toLowerCase();
}

export function evaluateTraceRules(
  trace: CoverLetterTraceResult,
  v0: CoverLetterResult,
  interview: InterviewResult,
  expected: CoverLetterTraceExpected,
): TraceRuleCoreScore {
  const weaknessCount = trace.weaknesses.length;
  const weaknessCountInRange =
    weaknessCount >= expected.minWeaknessCount &&
    weaknessCount <= expected.maxWeaknessCount;

  const interviewQuestionSet = new Set(
    interview.questions.map((q) => q.question.trim()),
  );
  const evidenceQuestionMatches = trace.weaknesses.filter((w) =>
    interviewQuestionSet.has(w.evidenceQuestion.trim()),
  ).length;
  const evidenceQuestionMatchRate =
    weaknessCount > 0 ? evidenceQuestionMatches / weaknessCount : 0;

  const v0Text = v0AllText(v0);
  const evidenceLinkMatches = trace.weaknesses.filter((w) => {
    const tokens = w.summary
      .toLowerCase()
      .split(/[\s,.()·]+/)
      .filter((t) => t.length >= 3);
    if (tokens.length === 0) return false;
    const hits = tokens.filter((t) => v0Text.includes(t)).length;
    return hits / tokens.length >= 0.4;
  }).length;
  const evidenceLinkRate =
    weaknessCount > 0 ? evidenceLinkMatches / weaknessCount : 0;

  const withRelatedHeading = trace.weaknesses.filter((w) =>
    Boolean(w.relatedHeading?.trim()),
  );
  const relatedHeadingValid = withRelatedHeading.filter((w) =>
    ALLOWED_HEADINGS.has(w.relatedHeading?.trim() ?? ""),
  ).length;
  const relatedHeadingValidRate =
    withRelatedHeading.length > 0
      ? relatedHeadingValid / withRelatedHeading.length
      : 1;

  return {
    weaknessCount,
    weaknessCountInRange,
    evidenceQuestionMatchRate,
    evidenceLinkRate,
    relatedHeadingValidRate,
  };
}

export function evaluateRefineRules(
  refine: CoverLetterRefineResult,
  inputWeaknessCount: number,
): RefineRuleCoreScore {
  const appliedCount = refine.appliedWeaknessIds.length;
  const appliedWeaknessRate =
    inputWeaknessCount > 0 ? appliedCount / inputWeaknessCount : 0;
  const changeNotesPerWeakness =
    appliedCount > 0 ? refine.changeNotes.length / appliedCount : 0;
  return {
    appliedWeaknessRate,
    changeNotesPerWeakness,
  };
}

export function summarizeCoverLetterTraceRules(
  rules: CoverLetterTraceRuleScore,
): string {
  return [
    `schema=${rules.schemaValidity ? "✓" : "✗"}`,
    `wk=${rules.weaknessCount}/${rules.weaknessCountInRange ? "✓" : "✗"}`,
    `evQ=${(rules.evidenceQuestionMatchRate * 100).toFixed(0)}%`,
    `evL=${(rules.evidenceLinkRate * 100).toFixed(0)}%`,
    `refine=${rules.refineSchemaValidity ? "✓" : "✗"}`,
    `app=${(rules.appliedWeaknessRate * 100).toFixed(0)}%`,
  ].join(" ");
}
