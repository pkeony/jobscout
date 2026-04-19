#!/usr/bin/env tsx
/**
 * cover-letter-traces.jsonl 합성 헬퍼.
 * - cover-letter goldset 의 jdText/profile/analysisResult/focusPosition 을 그대로 사용
 * - 최신 cover-letter eval report 의 case 별 result → coverLetterV0 (정적 박제)
 * - 최신 interview eval report 의 case 별 result → interviewResult (정적 박제)
 * - expected.judgeRubric 은 cover-letter goldset 의 것 재사용
 *
 * usage:
 *   pnpm tsx eval/build-trace-goldset.ts \
 *     --cover-report=<path> --interview-report=<path> --out=<path>
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  CoverLetterEvalReportSchema,
  CoverLetterGoldsetSchema,
  InterviewEvalReportSchema,
  type CoverLetterGoldsetCase,
  type CoverLetterTraceGoldsetCase,
} from "./types";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [k, v] = raw.slice(2).split("=");
    out[k] = v ?? "true";
  }
  return out;
}

function loadJsonl<T>(
  path: string,
  validate: (v: unknown) => T,
): T[] {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => validate(JSON.parse(line)));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const coverReportPath = args["cover-report"];
  const interviewReportPath = args["interview-report"];
  const outPath = args.out ?? "eval/goldset/cover-letter-traces.jsonl";
  const goldsetPath = args.goldset ?? "eval/goldset/cover-letters.jsonl";

  if (!coverReportPath || !interviewReportPath) {
    console.error("❌ --cover-report 와 --interview-report 필수");
    process.exit(1);
  }

  const coverReport = CoverLetterEvalReportSchema.parse(
    JSON.parse(readFileSync(coverReportPath, "utf8")),
  );
  const interviewReport = InterviewEvalReportSchema.parse(
    JSON.parse(readFileSync(interviewReportPath, "utf8")),
  );
  const goldset = loadJsonl<CoverLetterGoldsetCase>(goldsetPath, (v) =>
    CoverLetterGoldsetSchema.parse(v),
  );

  const coverByCase = new Map(coverReport.cases.map((c) => [c.caseId, c]));
  const interviewByCase = new Map(
    interviewReport.cases.map((c) => [c.caseId, c]),
  );

  const out: CoverLetterTraceGoldsetCase[] = [];
  const skipped: string[] = [];

  for (const base of goldset) {
    const coverCase = coverByCase.get(base.id);
    const interviewCase = interviewByCase.get(base.id);
    if (!coverCase?.result || !interviewCase?.result) {
      skipped.push(
        `${base.id} (cover=${Boolean(coverCase?.result)} interview=${Boolean(interviewCase?.result)})`,
      );
      continue;
    }
    out.push({
      id: base.id,
      label: base.label,
      target: "cover-letter-trace",
      jdText: base.jdText,
      analysisResult: base.analysisResult,
      profile: base.profile,
      focusPosition: base.focusPosition,
      coverLetterV0: coverCase.result,
      interviewResult: interviewCase.result,
      expected: {
        requiredHeadings: [...base.expected.requiredHeadings],
        minParagraphsPerSection: base.expected.minParagraphsPerSection,
        maxParagraphsPerSection: base.expected.maxParagraphsPerSection,
        expectedCompanyName: base.expected.expectedCompanyName,
        judgeRubric: base.expected.judgeRubric,
        minWeaknessCount: 3,
        maxWeaknessCount: 8,
      },
    });
  }

  writeFileSync(
    outPath,
    out.map((c) => JSON.stringify(c)).join("\n") + "\n",
    "utf8",
  );

  console.log(`✓ 합성 완료: ${out.length}개 case → ${outPath}`);
  if (skipped.length > 0) {
    console.log(`⚠ 스킵: ${skipped.length}개 — ${skipped.join(", ")}`);
  }
}

main();
