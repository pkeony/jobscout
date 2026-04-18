import type { CoverLetterResult } from "@/types";
import type {
  CoverLetterExpected,
  CoverLetterRuleScore,
} from "../types";

const STAR_KEYWORDS = [
  "상황",
  "situation",
  "문제",
  "과제",
  "task",
  "접근",
  "action",
  "실행",
  "도입",
  "구현",
  "결과",
  "result",
  "개선",
  "향상",
  "달성",
];

function countStarKeywords(text: string): number {
  const lower = text.toLowerCase();
  return STAR_KEYWORDS.reduce((sum, kw) => {
    const matches = lower.split(kw.toLowerCase()).length - 1;
    return sum + matches;
  }, 0);
}

function headingMatches(heading: string, required: string): boolean {
  return heading === required || heading.includes(required);
}

export function evaluateCoverLetterRules(
  result: CoverLetterResult,
  expected: CoverLetterExpected,
): Omit<CoverLetterRuleScore, "schemaValidity"> {
  const sectionCount = result.sections.length;

  const headingsMatched = expected.requiredHeadings.filter((req) =>
    result.sections.some((s) => headingMatches(s.heading, req)),
  ).length;
  const headingsTotal = expected.requiredHeadings.length;

  const paragraphCountValid = result.sections.every((s) => {
    const len = s.paragraphs.length;
    return (
      len >= expected.minParagraphsPerSection &&
      len <= expected.maxParagraphsPerSection
    );
  });

  const companyTrimmed = result.companyName.trim();
  let companyNamePresent = Boolean(companyTrimmed);
  if (expected.expectedCompanyName) {
    companyNamePresent =
      companyNamePresent &&
      companyTrimmed.toLowerCase().includes(
        expected.expectedCompanyName.toLowerCase(),
      );
  }

  const jobTitlePresent = Boolean(result.jobTitle.trim());

  const allText = result.sections
    .flatMap((s) => s.paragraphs)
    .join("\n");
  const starKeywordCount = countStarKeywords(allText);

  return {
    sectionCount,
    headingsMatched,
    headingsTotal,
    paragraphCountValid,
    companyNamePresent,
    jobTitlePresent,
    starKeywordCount,
  };
}

export function summarizeCoverLetterRules(
  rules: CoverLetterRuleScore,
): string {
  return [
    `schema=${rules.schemaValidity ? "✓" : "✗"}`,
    `sections=${rules.sectionCount}`,
    `headings=${rules.headingsMatched}/${rules.headingsTotal}`,
    `paras=${rules.paragraphCountValid ? "✓" : "✗"}`,
    `company=${rules.companyNamePresent ? "✓" : "✗"}`,
    `title=${rules.jobTitlePresent ? "✓" : "✗"}`,
    `star=${rules.starKeywordCount}`,
  ].join(" ");
}
