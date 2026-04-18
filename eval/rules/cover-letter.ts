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

const STAR_LABELS = ["[Situation]", "[Task]", "[Action]", "[Result]"] as const;

const STAR_LABEL_REQUIRED_SECTIONS = ["핵심 역량", "성장 경험"] as const;

function countStarKeywords(text: string): number {
  const lower = text.toLowerCase();
  return STAR_KEYWORDS.reduce((sum, kw) => {
    const matches = lower.split(kw.toLowerCase()).length - 1;
    return sum + matches;
  }, 0);
}

function countStarLabelsInText(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const label of STAR_LABELS) {
    const matches = text.split(label).length - 1;
    counts[label] = matches;
  }
  return counts;
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

  // STAR 라벨 (정확한 [Situation]/[Task]/[Action]/[Result]) 집계.
  // 지원 동기·입사 후 포부 섹션은 예외 — 핵심 역량·성장 경험 섹션만 모든 라벨 등장 확인.
  let starLabelCount = 0;
  let starLabelFullySatisfiedSections = 0;
  for (const section of result.sections) {
    const sectionText = section.paragraphs.join("\n");
    const counts = countStarLabelsInText(sectionText);
    starLabelCount += STAR_LABELS.reduce((sum, l) => sum + counts[l], 0);
    const isRequired = STAR_LABEL_REQUIRED_SECTIONS.some((req) =>
      section.heading.includes(req),
    );
    if (isRequired && STAR_LABELS.every((l) => counts[l] >= 1)) {
      starLabelFullySatisfiedSections++;
    }
  }

  return {
    sectionCount,
    headingsMatched,
    headingsTotal,
    paragraphCountValid,
    companyNamePresent,
    jobTitlePresent,
    starKeywordCount,
    starLabelCount,
    starLabelFullySatisfiedSections,
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
    `star=kw${rules.starKeywordCount}/label${rules.starLabelCount}/full${rules.starLabelFullySatisfiedSections}`,
  ].join(" ");
}
