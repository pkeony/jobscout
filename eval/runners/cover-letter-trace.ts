import { streamToJson } from "@/lib/ai/stream";
import type { ModelId } from "@/lib/ai/types";
import {
  COVER_LETTER_REFINE_RESPONSE_SCHEMA,
  COVER_LETTER_TRACE_RESPONSE_SCHEMA,
} from "@/lib/ai/schemas";
import {
  COVER_LETTER_REFINE_SYSTEM_PROMPT,
  PROMPT_VERSION as REFINE_PROMPT_VERSION,
  buildCoverLetterRefineMessages,
  extractCoverLetterRefineJson,
  normalizeCoverLetterRefine,
} from "@/lib/prompts/cover-letter-refine";
import {
  COVER_LETTER_TRACE_SYSTEM_PROMPT,
  PROMPT_VERSION as TRACE_PROMPT_VERSION,
  buildCoverLetterTraceMessages,
  extractCoverLetterTraceJson,
  normalizeCoverLetterTrace,
} from "@/lib/prompts/cover-letter-trace";
import type {
  CoverLetterRefineResult,
  CoverLetterResult,
  CoverLetterTraceResult,
} from "@/types";
import { loadGoldset } from "../goldset";
import { judgeCoverLetter } from "../judges/cover-letter";
import { evaluateCoverLetterRules } from "../rules/cover-letter";
import {
  evaluateRefineRules,
  evaluateTraceRules,
  summarizeCoverLetterTraceRules,
} from "../rules/cover-letter-trace";
import {
  CoverLetterTraceGoldsetSchema,
  type CoverLetterGoldsetCase,
  type CoverLetterRuleScore,
  type CoverLetterTraceAggregate,
  type CoverLetterTraceCaseReport,
  type CoverLetterTraceEvalReport,
  type CoverLetterTraceGoldsetCase,
  type CoverLetterTraceRuleScore,
} from "../types";

const EMPTY_COVER_LETTER_RULES: CoverLetterRuleScore = {
  schemaValidity: false,
  sectionCount: 0,
  headingsMatched: 0,
  headingsTotal: 0,
  paragraphCountValid: false,
  companyNamePresent: false,
  jobTitlePresent: false,
  starKeywordCount: 0,
  starLabelCount: 0,
  starLabelFullySatisfiedSections: 0,
};

function emptyTraceRules(): CoverLetterTraceRuleScore {
  return {
    schemaValidity: false,
    weaknessCount: 0,
    weaknessCountInRange: false,
    evidenceQuestionMatchRate: 0,
    evidenceLinkRate: 0,
    relatedHeadingValidRate: 0,
    refineSchemaValidity: false,
    appliedWeaknessRate: 0,
    changeNotesPerWeakness: 0,
    v0Rules: { ...EMPTY_COVER_LETTER_RULES },
    v1Rules: { ...EMPTY_COVER_LETTER_RULES },
  };
}

export async function runCoverLetterTraceCase(
  apiKey: string,
  case_: CoverLetterTraceGoldsetCase,
  model: ModelId,
): Promise<CoverLetterTraceCaseReport> {
  const startMs = Date.now();
  let trace: CoverLetterTraceResult | null = null;
  let refine: CoverLetterRefineResult | null = null;
  let traceTokensIn = 0;
  let traceTokensOut = 0;
  let refineTokensIn = 0;
  let refineTokensOut = 0;
  let traceSchemaValid = false;
  let refineSchemaValid = false;
  let runError: string | undefined;

  // 1. trace 호출
  try {
    const draft = await streamToJson<CoverLetterTraceResult>(
      apiKey,
      buildCoverLetterTraceMessages(
        case_.coverLetterV0,
        case_.interviewResult,
        case_.jdText,
        {
          profile: case_.profile,
          analysisResult: case_.analysisResult,
          focusPosition: case_.focusPosition,
        },
      ),
      {
        model,
        system: COVER_LETTER_TRACE_SYSTEM_PROMPT,
        temperature: 0.1,
        maxTokens: 8192,
        responseJson: { schema: COVER_LETTER_TRACE_RESPONSE_SCHEMA },
      },
      extractCoverLetterTraceJson,
    );
    trace = normalizeCoverLetterTrace(draft.result);
    traceTokensIn = draft.tokensIn;
    traceTokensOut = draft.tokensOut;
    traceSchemaValid = true;
  } catch (err) {
    runError = `trace: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 2. refine 호출 — trace 성공 시에만
  if (trace && trace.weaknesses.length > 0) {
    const inputIds = trace.weaknesses.map((w) => w.id);
    try {
      const draft = await streamToJson<CoverLetterRefineResult>(
        apiKey,
        buildCoverLetterRefineMessages(
          case_.coverLetterV0,
          trace.weaknesses,
          case_.jdText,
          {
            profile: case_.profile,
            analysisResult: case_.analysisResult,
            focusPosition: case_.focusPosition,
          },
        ),
        {
          model,
          system: COVER_LETTER_REFINE_SYSTEM_PROMPT,
          temperature: 0.1,
          maxTokens: 8192,
          responseJson: { schema: COVER_LETTER_REFINE_RESPONSE_SCHEMA },
        },
        extractCoverLetterRefineJson,
      );
      refine = normalizeCoverLetterRefine(draft.result, inputIds);
      refineTokensIn = draft.tokensIn;
      refineTokensOut = draft.tokensOut;
      refineSchemaValid = true;
    } catch (err) {
      runError =
        (runError ? runError + " | " : "") +
        `refine: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const latencyMs = Date.now() - startMs;
  const tokensIn = traceTokensIn + refineTokensIn;
  const tokensOut = traceTokensOut + refineTokensOut;

  // 3. v0/v1 cover-letter rule 채점 (같은 expected 사용)
  const coverLetterExpected = {
    requiredHeadings: case_.expected.requiredHeadings,
    minParagraphsPerSection: case_.expected.minParagraphsPerSection,
    maxParagraphsPerSection: case_.expected.maxParagraphsPerSection,
    expectedCompanyName: case_.expected.expectedCompanyName,
    judgeRubric: case_.expected.judgeRubric,
  };
  const v0Rules: CoverLetterRuleScore = {
    schemaValidity: true,
    ...evaluateCoverLetterRules(case_.coverLetterV0, coverLetterExpected),
  };
  const v1Rules: CoverLetterRuleScore = refine
    ? {
        schemaValidity: true,
        ...evaluateCoverLetterRules(refine.revised, coverLetterExpected),
      }
    : { ...EMPTY_COVER_LETTER_RULES };

  // 4. trace + refine rule 채점
  const traceCore = trace
    ? evaluateTraceRules(
        trace,
        case_.coverLetterV0,
        case_.interviewResult,
        case_.expected,
      )
    : {
        weaknessCount: 0,
        weaknessCountInRange: false,
        evidenceQuestionMatchRate: 0,
        evidenceLinkRate: 0,
        relatedHeadingValidRate: 0,
      };
  const refineCore =
    refine && trace
      ? evaluateRefineRules(refine, trace.weaknesses.length)
      : { appliedWeaknessRate: 0, changeNotesPerWeakness: 0 };

  const rules: CoverLetterTraceRuleScore = {
    schemaValidity: traceSchemaValid,
    ...traceCore,
    refineSchemaValidity: refineSchemaValid,
    ...refineCore,
    v0Rules,
    v1Rules,
  };

  // 5. v0/v1 judge — judgeCoverLetter 가 cover-letter goldset 형태를 받으므로 어댑터 obj 생성
  const judgeAsCoverLetter = (target: CoverLetterResult) => {
    const adaptedCase: CoverLetterGoldsetCase = {
      id: case_.id,
      label: case_.label,
      jdText: case_.jdText,
      analysisResult: case_.analysisResult,
      profile: case_.profile,
      focusPosition: case_.focusPosition,
      target: "cover-letter",
      expected: coverLetterExpected,
    };
    return judgeCoverLetter(adaptedCase, target);
  };

  let v0Judge: CoverLetterTraceCaseReport["v0Judge"] = null;
  let v1Judge: CoverLetterTraceCaseReport["v1Judge"] = null;
  let judgeDelta: number | null = null;
  try {
    v0Judge = await judgeAsCoverLetter(case_.coverLetterV0);
  } catch (err) {
    runError =
      (runError ? runError + " | " : "") +
      `v0Judge: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (refine) {
    try {
      v1Judge = await judgeAsCoverLetter(refine.revised);
    } catch (err) {
      runError =
        (runError ? runError + " | " : "") +
        `v1Judge: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  if (v0Judge && v1Judge) {
    judgeDelta = v1Judge.score - v0Judge.score;
  }

  return {
    caseId: case_.id,
    label: case_.label,
    model,
    target: "cover-letter-trace",
    latencyMs,
    tokensIn,
    tokensOut,
    traceResult: trace,
    refineResult: refine,
    rules,
    v0Judge,
    v1Judge,
    judgeDelta,
    error: runError,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100));
  return sorted[idx];
}

export function computeCoverLetterTraceAggregate(
  reports: CoverLetterTraceCaseReport[],
): CoverLetterTraceAggregate {
  const total = reports.length || 1;

  const schemaValidityRate =
    reports.filter((r) => r.rules.schemaValidity).length / total;
  const weaknessCountInRangeRate =
    reports.filter((r) => r.rules.weaknessCountInRange).length / total;
  const avgWeaknessCount =
    reports.reduce((s, r) => s + r.rules.weaknessCount, 0) / total;
  const avgEvidenceQuestionMatchRate =
    reports.reduce((s, r) => s + r.rules.evidenceQuestionMatchRate, 0) / total;
  const avgEvidenceLinkRate =
    reports.reduce((s, r) => s + r.rules.evidenceLinkRate, 0) / total;
  const avgRelatedHeadingValidRate =
    reports.reduce((s, r) => s + r.rules.relatedHeadingValidRate, 0) / total;

  const refineSchemaValidityRate =
    reports.filter((r) => r.rules.refineSchemaValidity).length / total;
  const avgAppliedWeaknessRate =
    reports.reduce((s, r) => s + r.rules.appliedWeaknessRate, 0) / total;
  const avgChangeNotesPerWeakness =
    reports.reduce((s, r) => s + r.rules.changeNotesPerWeakness, 0) / total;

  // delta KPI
  const v0JudgeScores = reports
    .map((r) => r.v0Judge?.score)
    .filter((s): s is number => typeof s === "number");
  const v1JudgeScores = reports
    .map((r) => r.v1Judge?.score)
    .filter((s): s is number => typeof s === "number");
  const judgeAvgV0 =
    v0JudgeScores.length > 0
      ? v0JudgeScores.reduce((s, v) => s + v, 0) / v0JudgeScores.length
      : 0;
  const judgeAvgV1 =
    v1JudgeScores.length > 0
      ? v1JudgeScores.reduce((s, v) => s + v, 0) / v1JudgeScores.length
      : 0;
  const judgeDeltas = reports
    .map((r) => r.judgeDelta)
    .filter((d): d is number => typeof d === "number");
  const judgeDelta =
    judgeDeltas.length > 0
      ? judgeDeltas.reduce((s, v) => s + v, 0) / judgeDeltas.length
      : 0;
  const improvedRate =
    judgeDeltas.length > 0
      ? judgeDeltas.filter((d) => d > 0.1).length / judgeDeltas.length
      : 0;

  // sub-indicator delta (v1 - v0)
  const headingsCoverageDelta = (() => {
    const v0Total = reports.reduce((s, r) => s + r.rules.v0Rules.headingsTotal, 0);
    const v0Matched = reports.reduce(
      (s, r) => s + r.rules.v0Rules.headingsMatched,
      0,
    );
    const v1Total = reports.reduce((s, r) => s + r.rules.v1Rules.headingsTotal, 0);
    const v1Matched = reports.reduce(
      (s, r) => s + r.rules.v1Rules.headingsMatched,
      0,
    );
    const v0 = v0Total > 0 ? v0Matched / v0Total : 0;
    const v1 = v1Total > 0 ? v1Matched / v1Total : 0;
    return v1 - v0;
  })();
  const starLabelCountDelta =
    reports.reduce(
      (s, r) => s + (r.rules.v1Rules.starLabelCount - r.rules.v0Rules.starLabelCount),
      0,
    ) / total;
  const starLabelFullyCoveredDelta = (() => {
    const v0 =
      reports.filter((r) => r.rules.v0Rules.starLabelFullySatisfiedSections >= 2)
        .length / total;
    const v1 =
      reports.filter((r) => r.rules.v1Rules.starLabelFullySatisfiedSections >= 2)
        .length / total;
    return v1 - v0;
  })();

  const latencies = reports.map((r) => r.latencyMs);
  const tokensIn = reports.map((r) => r.tokensIn);
  const tokensOut = reports.map((r) => r.tokensOut);

  return {
    schemaValidityRate,
    weaknessCountInRangeRate,
    avgWeaknessCount,
    avgEvidenceQuestionMatchRate,
    avgEvidenceLinkRate,
    avgRelatedHeadingValidRate,
    refineSchemaValidityRate,
    avgAppliedWeaknessRate,
    avgChangeNotesPerWeakness,
    judgeAvgV0,
    judgeAvgV1,
    judgeDelta,
    improvedRate,
    headingsCoverageDelta,
    starLabelCountDelta,
    starLabelFullyCoveredDelta,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgTokensIn: tokensIn.reduce((s, v) => s + v, 0) / total,
    avgTokensOut: tokensOut.reduce((s, v) => s + v, 0) / total,
  };
}

export interface RunCoverLetterTraceEvalOpts {
  goldsetPath: string;
  model: ModelId;
}

export async function runCoverLetterTraceEval(
  opts: RunCoverLetterTraceEvalOpts,
): Promise<CoverLetterTraceEvalReport> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY가 설정되지 않았습니다.");
  }

  const cases = await loadGoldset(opts.goldsetPath, CoverLetterTraceGoldsetSchema);
  console.log(
    `[eval·cover-letter-trace] ${cases.length}개 case 로드 · model=${opts.model}`,
  );

  const reports: CoverLetterTraceCaseReport[] = [];
  for (const case_ of cases) {
    const start = Date.now();
    const report = await runCoverLetterTraceCase(apiKey, case_, opts.model);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const judgePart =
      report.v0Judge !== null && report.v1Judge !== null
        ? `judge ${report.v0Judge.score.toFixed(2)}→${report.v1Judge.score.toFixed(2)} (Δ${(report.judgeDelta ?? 0).toFixed(2)})`
        : "judge=skipped";
    const errPart = report.error ? ` ERROR=${report.error.slice(0, 80)}` : "";
    console.log(
      `[${case_.id}] ${summarizeCoverLetterTraceRules(report.rules)} ${judgePart} (${elapsed}s)${errPart}`,
    );
    reports.push(report);
  }

  return {
    runId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    target: "cover-letter-trace",
    model: opts.model,
    promptVersion: TRACE_PROMPT_VERSION,
    refinePromptVersion: REFINE_PROMPT_VERSION,
    caseCount: cases.length,
    cases: reports,
    aggregate: computeCoverLetterTraceAggregate(reports),
  };
}

export function printCoverLetterTraceReport(
  report: CoverLetterTraceEvalReport,
): void {
  const a = report.aggregate;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const sgn = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;

  console.log("");
  console.log(
    `=== EVAL REPORT (cover-letter-trace) · ${report.runId} · ${report.model} ===`,
  );
  console.log(
    `cases: ${report.caseCount}  started: ${report.startedAt}  trace: ${report.promptVersion ?? "n/a"}  refine: ${report.refinePromptVersion ?? "n/a"}`,
  );
  console.log("");

  for (const c of report.cases) {
    const judgePart =
      c.v0Judge !== null && c.v1Judge !== null
        ? `${c.v0Judge.score.toFixed(2)}→${c.v1Judge.score.toFixed(2)} Δ${(c.judgeDelta ?? 0).toFixed(2)}`
        : "skipped";
    console.log(
      `  ${c.caseId.padEnd(8)} ${summarizeCoverLetterTraceRules(c.rules)} judge=${judgePart}  ${c.label}`,
    );
  }

  console.log("");
  console.log("AGGREGATE — TRACE");
  console.log(`  schemaValidity         ${pct(a.schemaValidityRate)}`);
  console.log(
    `  weaknessCountInRange   ${pct(a.weaknessCountInRangeRate)} (avg=${a.avgWeaknessCount.toFixed(1)})`,
  );
  console.log(`  evidenceQuestionMatch  ${pct(a.avgEvidenceQuestionMatchRate)}`);
  console.log(`  evidenceLinkRate       ${pct(a.avgEvidenceLinkRate)}`);
  console.log(`  relatedHeadingValid    ${pct(a.avgRelatedHeadingValidRate)}`);
  console.log("");
  console.log("AGGREGATE — REFINE");
  console.log(`  schemaValidity         ${pct(a.refineSchemaValidityRate)}`);
  console.log(`  appliedWeaknessRate    ${pct(a.avgAppliedWeaknessRate)}`);
  console.log(`  changeNotes/weakness   ${a.avgChangeNotesPerWeakness.toFixed(2)}`);
  console.log("");
  console.log("AGGREGATE — DELTA (PRIMARY KPI)");
  console.log(
    `  judge v0/v1            ${a.judgeAvgV0.toFixed(3)} → ${a.judgeAvgV1.toFixed(3)}  (Δ=${sgn(a.judgeDelta)})`,
  );
  console.log(`  improvedRate (>+0.10)  ${pct(a.improvedRate)}`);
  console.log(`  headingsCoverage Δ     ${sgn(a.headingsCoverageDelta)}`);
  console.log(`  starLabelCount Δ       ${sgn(a.starLabelCountDelta)} /case`);
  console.log(`  starFullyCovered Δ     ${sgn(a.starLabelFullyCoveredDelta)}`);
  console.log("");
  console.log("PERF");
  console.log(`  latency p50/p95        ${a.p50LatencyMs}ms / ${a.p95LatencyMs}ms`);
  console.log(
    `  tokens avg in/out      ${Math.round(a.avgTokensIn)} / ${Math.round(a.avgTokensOut)}`,
  );
  console.log("");
}
