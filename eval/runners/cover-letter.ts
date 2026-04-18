import { streamToJson } from "@/lib/ai/stream";
import type { ModelId } from "@/lib/ai/types";
import { COVER_LETTER_RESPONSE_SCHEMA } from "@/lib/ai/schemas";
import {
  COVER_LETTER_SYSTEM_PROMPT,
  PROMPT_VERSION as COVER_LETTER_PROMPT_VERSION,
  buildCoverLetterMessages,
  extractCoverLetterJson,
  normalizeCoverLetter,
} from "@/lib/prompts/cover-letter";
import type { CoverLetterResult } from "@/types";
import { loadGoldset } from "../goldset";
import { judgeCoverLetter } from "../judges/cover-letter";
import {
  evaluateCoverLetterRules,
  summarizeCoverLetterRules,
} from "../rules/cover-letter";
import {
  CoverLetterGoldsetSchema,
  type CoverLetterAggregate,
  type CoverLetterCaseReport,
  type CoverLetterEvalReport,
  type CoverLetterGoldsetCase,
  type CoverLetterRuleScore,
} from "../types";

const EMPTY_RULES: CoverLetterRuleScore = {
  schemaValidity: false,
  sectionCount: 0,
  headingsMatched: 0,
  headingsTotal: 0,
  paragraphCountValid: false,
  companyNamePresent: false,
  jobTitlePresent: false,
  starKeywordCount: 0,
};

export async function runCoverLetterCase(
  apiKey: string,
  case_: CoverLetterGoldsetCase,
  model: ModelId,
): Promise<CoverLetterCaseReport> {
  const startMs = Date.now();
  const messages = buildCoverLetterMessages(case_.jdText, case_.profile, {
    analysisResult: case_.analysisResult,
    focusPosition: case_.focusPosition,
  });

  let result: CoverLetterResult | null = null;
  let tokensIn = 0;
  let tokensOut = 0;
  let schemaValidity = false;
  let streamError: string | undefined;

  try {
    const draft = await streamToJson<CoverLetterResult>(
      apiKey,
      messages,
      {
        model,
        system: COVER_LETTER_SYSTEM_PROMPT,
        temperature: 0.4,
        maxTokens: 4096,
        responseJson: { schema: COVER_LETTER_RESPONSE_SCHEMA },
      },
      extractCoverLetterJson,
    );
    result = normalizeCoverLetter(draft.result);
    tokensIn = draft.tokensIn;
    tokensOut = draft.tokensOut;
    schemaValidity = true;
  } catch (err) {
    streamError = err instanceof Error ? err.message : String(err);
  }

  const latencyMs = Date.now() - startMs;

  if (!result) {
    return {
      caseId: case_.id,
      label: case_.label,
      model,
      target: "cover-letter",
      latencyMs,
      tokensIn,
      tokensOut,
      result: null,
      rules: {
        ...EMPTY_RULES,
        headingsTotal: case_.expected.requiredHeadings.length,
      },
      judge: null,
      error: streamError ?? "자소서 생성/파싱 실패",
    };
  }

  const rulePartial = evaluateCoverLetterRules(result, case_.expected);
  const rules: CoverLetterRuleScore = { schemaValidity, ...rulePartial };

  let judge: CoverLetterCaseReport["judge"] = null;
  try {
    judge = await judgeCoverLetter(case_, result);
  } catch (err) {
    streamError = err instanceof Error ? err.message : String(err);
  }

  return {
    caseId: case_.id,
    label: case_.label,
    model,
    target: "cover-letter",
    latencyMs,
    tokensIn,
    tokensOut,
    result,
    rules,
    judge,
    error: streamError,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100));
  return sorted[idx];
}

export function computeCoverLetterAggregate(
  reports: CoverLetterCaseReport[],
): CoverLetterAggregate {
  const total = reports.length || 1;
  const schemaValidityRate =
    reports.filter((r) => r.rules.schemaValidity).length / total;
  const sectionCountExactRate =
    reports.filter((r) => r.rules.sectionCount === 4).length / total;

  const hMatched = reports.reduce((s, r) => s + r.rules.headingsMatched, 0);
  const hTotal = reports.reduce((s, r) => s + r.rules.headingsTotal, 0);
  const headingsCoverage = hTotal > 0 ? hMatched / hTotal : 0;

  const paragraphCountValidRate =
    reports.filter((r) => r.rules.paragraphCountValid).length / total;
  const companyNamePresentRate =
    reports.filter((r) => r.rules.companyNamePresent).length / total;
  const jobTitlePresentRate =
    reports.filter((r) => r.rules.jobTitlePresent).length / total;
  const avgStarKeywordCount =
    reports.reduce((s, r) => s + r.rules.starKeywordCount, 0) / total;

  const judgeScores = reports
    .map((r) => r.judge?.score)
    .filter((s): s is number => typeof s === "number");
  const judgeAvg =
    judgeScores.length > 0
      ? judgeScores.reduce((s, v) => s + v, 0) / judgeScores.length
      : 0;

  const latencies = reports.map((r) => r.latencyMs);
  const tokensIn = reports.map((r) => r.tokensIn);
  const tokensOut = reports.map((r) => r.tokensOut);

  return {
    schemaValidityRate,
    sectionCountExactRate,
    headingsCoverage,
    paragraphCountValidRate,
    companyNamePresentRate,
    jobTitlePresentRate,
    avgStarKeywordCount,
    judgeAvg,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgTokensIn: tokensIn.reduce((s, v) => s + v, 0) / total,
    avgTokensOut: tokensOut.reduce((s, v) => s + v, 0) / total,
  };
}

export interface RunCoverLetterEvalOpts {
  goldsetPath: string;
  model: ModelId;
}

export async function runCoverLetterEval(
  opts: RunCoverLetterEvalOpts,
): Promise<CoverLetterEvalReport> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY가 설정되지 않았습니다.");
  }

  const cases = await loadGoldset(opts.goldsetPath, CoverLetterGoldsetSchema);
  console.log(
    `[eval·cover-letter] ${cases.length}개 case 로드 · model=${opts.model}`,
  );

  const reports: CoverLetterCaseReport[] = [];
  for (const case_ of cases) {
    const start = Date.now();
    const report = await runCoverLetterCase(apiKey, case_, opts.model);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const judgePart =
      report.judge !== null
        ? `judge=${report.judge.score.toFixed(2)}`
        : "judge=skipped";
    const errPart = report.error ? ` ERROR=${report.error.slice(0, 80)}` : "";
    console.log(
      `[${case_.id}] ${summarizeCoverLetterRules(report.rules)} ${judgePart} (${elapsed}s)${errPart}`,
    );
    reports.push(report);
  }

  return {
    runId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    target: "cover-letter",
    model: opts.model,
    promptVersion: COVER_LETTER_PROMPT_VERSION,
    caseCount: cases.length,
    cases: reports,
    aggregate: computeCoverLetterAggregate(reports),
  };
}

export function printCoverLetterReport(report: CoverLetterEvalReport): void {
  const a = report.aggregate;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  console.log("");
  console.log(
    `=== EVAL REPORT (cover-letter) · ${report.runId} · ${report.model} ===`,
  );
  console.log(
    `cases: ${report.caseCount}  started: ${report.startedAt}  promptVersion: ${report.promptVersion ?? "n/a"}`,
  );
  console.log("");

  for (const c of report.cases) {
    const judgePart =
      c.judge !== null ? `judge=${c.judge.score.toFixed(2)}` : "judge=skipped";
    console.log(
      `  ${c.caseId.padEnd(8)} ${summarizeCoverLetterRules(c.rules)} ${judgePart}  ${c.label}`,
    );
  }

  console.log("");
  console.log("AGGREGATE");
  console.log(`  schemaValidity        ${pct(a.schemaValidityRate)}`);
  console.log(`  sectionCount==4       ${pct(a.sectionCountExactRate)}`);
  console.log(`  headingsCoverage      ${a.headingsCoverage.toFixed(3)}`);
  console.log(`  paragraphCountValid   ${pct(a.paragraphCountValidRate)}`);
  console.log(`  companyNamePresent    ${pct(a.companyNamePresentRate)}`);
  console.log(`  jobTitlePresent       ${pct(a.jobTitlePresentRate)}`);
  console.log(`  avg STAR keywords     ${a.avgStarKeywordCount.toFixed(1)}/case`);
  console.log(`  judge avg             ${a.judgeAvg.toFixed(3)}`);
  console.log(
    `  latency p50/p95       ${a.p50LatencyMs}ms / ${a.p95LatencyMs}ms`,
  );
  console.log(
    `  tokens avg in/out     ${Math.round(a.avgTokensIn)} / ${Math.round(a.avgTokensOut)}`,
  );
  console.log("");
}
