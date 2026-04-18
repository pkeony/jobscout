import { stream } from "@/lib/ai/stream";
import type { ModelId } from "@/lib/ai/types";
import {
  ANALYZE_SYSTEM_PROMPT,
  PROMPT_VERSION as ANALYZE_PROMPT_VERSION,
  buildAnalyzeMessages,
  extractJson,
} from "@/lib/prompts/analyze";
import type { AnalysisResult } from "@/types";
import { loadGoldset } from "../goldset";
import { judgeAnalyze } from "../judges/analyze";
import {
  evaluateAnalyzeRules,
  summarizeAnalyzeRules,
} from "../rules/analyze";
import {
  AnalyzeGoldsetSchema,
  type AnalyzeAggregate,
  type AnalyzeCaseReport,
  type AnalyzeEvalReport,
  type AnalyzeGoldsetCase,
  type AnalyzeRuleScore,
} from "../types";

const EMPTY_RULES: AnalyzeRuleScore = {
  schemaValidity: false,
  skillsInRange: false,
  categoryEnumValid: false,
  mustHaveHits: 0,
  mustHaveTotal: 0,
  mustHavePreferredHits: 0,
  mustHavePreferredTotal: 0,
  companyInfoPresent: false,
  domainIntrusionCount: 0,
};

export async function runAnalyzeCase(
  apiKey: string,
  case_: AnalyzeGoldsetCase,
  model: ModelId,
): Promise<AnalyzeCaseReport> {
  const startMs = Date.now();
  const messages = buildAnalyzeMessages(case_.jdText, case_.focusPosition);

  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let streamError: string | undefined;

  try {
    for await (const event of stream(apiKey, messages, {
      model,
      system: ANALYZE_SYSTEM_PROMPT,
      temperature: 0,
      maxTokens: 16384,
      bufferedFallback: true,
    })) {
      if (event.type === "delta") fullText += event.text;
      if (event.type === "done") {
        tokensIn = event.usage.inputTokens;
        tokensOut = event.usage.outputTokens;
      }
    }
  } catch (err) {
    streamError = err instanceof Error ? err.message : String(err);
  }

  const latencyMs = Date.now() - startMs;

  let result: AnalysisResult | null = null;
  let schemaValidity = false;
  try {
    if (fullText) {
      result = extractJson(fullText);
      schemaValidity = true;
    }
  } catch (err) {
    streamError =
      streamError ?? (err instanceof Error ? err.message : String(err));
  }

  if (!result) {
    return {
      caseId: case_.id,
      label: case_.label,
      model,
      target: "analyze",
      latencyMs,
      tokensIn,
      tokensOut,
      result: null,
      rawOutput: fullText.slice(0, 500),
      rules: {
        ...EMPTY_RULES,
        mustHaveTotal: case_.expected.mustHaveSkills.length,
        mustHavePreferredTotal: case_.expected.mustHavePreferredSkills.length,
      },
      judge: null,
      error: streamError ?? "분석 결과 파싱 실패",
    };
  }

  const rulePartial = evaluateAnalyzeRules(result, case_.expected, case_.jdText);
  const rules: AnalyzeRuleScore = { schemaValidity, ...rulePartial };

  let judge: AnalyzeCaseReport["judge"] = null;
  try {
    judge = await judgeAnalyze(case_, result);
  } catch (err) {
    streamError = err instanceof Error ? err.message : String(err);
  }

  return {
    caseId: case_.id,
    label: case_.label,
    model,
    target: "analyze",
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

export function computeAnalyzeAggregate(
  reports: AnalyzeCaseReport[],
): AnalyzeAggregate {
  const total = reports.length || 1;
  const schemaValidityRate =
    reports.filter((r) => r.rules.schemaValidity).length / total;
  const skillsInRangeRate =
    reports.filter((r) => r.rules.skillsInRange).length / total;
  const categoryEnumValidRate =
    reports.filter((r) => r.rules.categoryEnumValid).length / total;

  const mhHits = reports.reduce((s, r) => s + r.rules.mustHaveHits, 0);
  const mhTotal = reports.reduce((s, r) => s + r.rules.mustHaveTotal, 0);
  const mustHaveCoverage = mhTotal > 0 ? mhHits / mhTotal : 0;

  const mhpHits = reports.reduce(
    (s, r) => s + r.rules.mustHavePreferredHits,
    0,
  );
  const mhpTotal = reports.reduce(
    (s, r) => s + r.rules.mustHavePreferredTotal,
    0,
  );
  const mustHavePreferredCoverage = mhpTotal > 0 ? mhpHits / mhpTotal : 0;

  const companyInfoPresentRate =
    reports.filter((r) => r.rules.companyInfoPresent).length / total;

  const intrusionViolations = reports.filter(
    (r) => r.rules.domainIntrusionCount > 0,
  ).length;
  const domainIntrusionRate = intrusionViolations / total;
  const avgDomainIntrusionCount =
    reports.reduce((s, r) => s + r.rules.domainIntrusionCount, 0) / total;

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
    skillsInRangeRate,
    categoryEnumValidRate,
    mustHaveCoverage,
    mustHavePreferredCoverage,
    companyInfoPresentRate,
    domainIntrusionRate,
    avgDomainIntrusionCount,
    judgeAvg,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgTokensIn: tokensIn.reduce((s, v) => s + v, 0) / total,
    avgTokensOut: tokensOut.reduce((s, v) => s + v, 0) / total,
  };
}

export interface RunAnalyzeEvalOpts {
  goldsetPath: string;
  model: ModelId;
}

export async function runAnalyzeEval(
  opts: RunAnalyzeEvalOpts,
): Promise<AnalyzeEvalReport> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY가 설정되지 않았습니다.");
  }

  const cases = await loadGoldset(opts.goldsetPath, AnalyzeGoldsetSchema);
  console.log(`[eval·analyze] ${cases.length}개 case 로드 · model=${opts.model}`);

  const reports: AnalyzeCaseReport[] = [];
  for (const case_ of cases) {
    const start = Date.now();
    const report = await runAnalyzeCase(apiKey, case_, opts.model);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const judgePart =
      report.judge !== null
        ? `judge=${report.judge.score.toFixed(2)}`
        : "judge=skipped";
    const errPart = report.error ? ` ERROR=${report.error.slice(0, 80)}` : "";
    console.log(
      `[${case_.id}] ${summarizeAnalyzeRules(report.rules)} ${judgePart} (${elapsed}s)${errPart}`,
    );
    reports.push(report);
  }

  return {
    runId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    target: "analyze",
    model: opts.model,
    promptVersion: ANALYZE_PROMPT_VERSION,
    caseCount: cases.length,
    cases: reports,
    aggregate: computeAnalyzeAggregate(reports),
  };
}

export function printAnalyzeReport(report: AnalyzeEvalReport): void {
  const a = report.aggregate;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  console.log("");
  console.log(
    `=== EVAL REPORT (analyze) · ${report.runId} · ${report.model} ===`,
  );
  console.log(
    `cases: ${report.caseCount}  started: ${report.startedAt}  promptVersion: ${report.promptVersion ?? "n/a"}`,
  );
  console.log("");

  for (const c of report.cases) {
    const judgePart =
      c.judge !== null ? `judge=${c.judge.score.toFixed(2)}` : "judge=skipped";
    console.log(
      `  ${c.caseId.padEnd(8)} ${summarizeAnalyzeRules(c.rules)} ${judgePart}  ${c.label}`,
    );
  }

  console.log("");
  console.log("AGGREGATE");
  console.log(`  schemaValidity        ${pct(a.schemaValidityRate)}`);
  console.log(`  skillsInRange         ${pct(a.skillsInRangeRate)}`);
  console.log(`  categoryEnumValid     ${pct(a.categoryEnumValidRate)}`);
  console.log(`  mustHaveCoverage      ${a.mustHaveCoverage.toFixed(3)}`);
  console.log(`  preferredCoverage     ${a.mustHavePreferredCoverage.toFixed(3)}`);
  console.log(`  companyInfoPresent    ${pct(a.companyInfoPresentRate)}`);
  console.log(
    `  domainIntrusionRate   ${pct(a.domainIntrusionRate)} (avg ${a.avgDomainIntrusionCount.toFixed(2)} hits/case)`,
  );
  console.log(`  judge avg             ${a.judgeAvg.toFixed(3)}`);
  console.log(
    `  latency p50/p95       ${a.p50LatencyMs}ms / ${a.p95LatencyMs}ms`,
  );
  console.log(
    `  tokens avg in/out     ${Math.round(a.avgTokensIn)} / ${Math.round(a.avgTokensOut)}`,
  );
  console.log("");
}
