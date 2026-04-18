import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stream } from "@/lib/ai/stream";
import type { ModelId } from "@/lib/ai/types";
import {
  MATCH_SYSTEM_PROMPT,
  buildMatchMessages,
  extractMatchJson,
} from "@/lib/prompts/match";
import type { MatchResult } from "@/types";
import { loadGoldset } from "./goldset";
import { judgeMatch } from "./judges";
import { evaluateRules, summarizeRules } from "./rules";
import type {
  Aggregate,
  CaseReport,
  EvalReport,
  GoldsetCase,
  RuleScore,
} from "./types";

const EMPTY_RULES: RuleScore = {
  schemaValidity: false,
  scoreInRange: false,
  scoreSanity: false,
  mustMatchHits: 0,
  mustMatchTotal: 0,
  mustNotGapViolations: 0,
};

async function runMatchCase(
  apiKey: string,
  case_: GoldsetCase,
  model: ModelId,
): Promise<CaseReport> {
  const startMs = Date.now();
  const messages = buildMatchMessages(case_.jdText, case_.profile, {
    analysisResult: case_.analysisResult,
    focusPosition: case_.focusPosition,
  });

  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let streamError: string | undefined;

  try {
    for await (const event of stream(apiKey, messages, {
      model,
      system: MATCH_SYSTEM_PROMPT,
      temperature: 0,
      maxTokens: 4096,
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

  let result: MatchResult | null = null;
  let schemaValidity = false;
  try {
    if (fullText) {
      result = extractMatchJson(fullText);
      schemaValidity = true;
    }
  } catch (err) {
    streamError = streamError ?? (err instanceof Error ? err.message : String(err));
  }

  if (!result) {
    return {
      caseId: case_.id,
      label: case_.label,
      model,
      latencyMs,
      tokensIn,
      tokensOut,
      result: null,
      rawOutput: fullText.slice(0, 500),
      rules: {
        ...EMPTY_RULES,
        mustMatchTotal: case_.expected.mustMatch.length,
      },
      judge: null,
      error: streamError ?? "매칭 결과 파싱 실패",
    };
  }

  const rulePartial = evaluateRules(result, case_.expected);
  const rules: RuleScore = { schemaValidity, ...rulePartial };

  let judge: CaseReport["judge"] = null;
  try {
    judge = await judgeMatch(case_, result);
  } catch (err) {
    streamError = err instanceof Error ? err.message : String(err);
  }

  return {
    caseId: case_.id,
    label: case_.label,
    model,
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

function computeAggregate(reports: CaseReport[]): Aggregate {
  const total = reports.length || 1;
  const schemaValidityRate =
    reports.filter((r) => r.rules.schemaValidity).length / total;
  const scoreInRangeRate =
    reports.filter((r) => r.rules.scoreInRange).length / total;
  const scoreSanityRate =
    reports.filter((r) => r.rules.scoreSanity).length / total;

  const mmHits = reports.reduce((s, r) => s + r.rules.mustMatchHits, 0);
  const mmTotal = reports.reduce((s, r) => s + r.rules.mustMatchTotal, 0);
  const skillCoverage = mmTotal > 0 ? mmHits / mmTotal : 0;

  const mustNotGapViolationRate =
    reports.filter((r) => r.rules.mustNotGapViolations > 0).length / total;

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
    scoreInRangeRate,
    scoreSanityRate,
    skillCoverage,
    mustNotGapViolationRate,
    judgeAvg,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgTokensIn: tokensIn.reduce((s, v) => s + v, 0) / total,
    avgTokensOut: tokensOut.reduce((s, v) => s + v, 0) / total,
  };
}

export interface RunEvalOpts {
  goldsetPath: string;
  model: ModelId;
  outDir: string;
}

export async function runEval(opts: RunEvalOpts): Promise<EvalReport> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY가 설정되지 않았습니다.");
  }

  const cases = await loadGoldset(opts.goldsetPath);
  console.log(`[eval] ${cases.length}개 case 로드 · model=${opts.model}`);

  const reports: CaseReport[] = [];
  for (const case_ of cases) {
    const start = Date.now();
    const report = await runMatchCase(apiKey, case_, opts.model);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const judgePart =
      report.judge !== null
        ? `judge=${report.judge.score.toFixed(2)}`
        : "judge=skipped";
    const errPart = report.error ? ` ERROR=${report.error.slice(0, 80)}` : "";
    console.log(
      `[${case_.id}] ${summarizeRules(report.rules)} ${judgePart} (${elapsed}s)${errPart}`,
    );
    reports.push(report);
  }

  const report: EvalReport = {
    runId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    model: opts.model,
    caseCount: cases.length,
    cases: reports,
    aggregate: computeAggregate(reports),
  };

  await persistReport(opts.outDir, report);
  return report;
}

async function persistReport(outDir: string, report: EvalReport): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const filename = `${report.runId}-${report.model}.json`;
  const path = join(outDir, filename);
  await writeFile(path, JSON.stringify(report, null, 2), "utf8");
  console.log(`[eval] 리포트 저장: ${path}`);
  // dirname 참조 유지 (향후 확장용)
  void dirname;
}

export function printReport(report: EvalReport): void {
  const a = report.aggregate;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  console.log("");
  console.log(`=== EVAL REPORT · ${report.runId} · ${report.model} ===`);
  console.log(`cases: ${report.caseCount}  started: ${report.startedAt}`);
  console.log("");

  for (const c of report.cases) {
    const judgePart =
      c.judge !== null ? `judge=${c.judge.score.toFixed(2)}` : "judge=skipped";
    console.log(
      `  ${c.caseId.padEnd(8)} ${summarizeRules(c.rules)} ${judgePart}  ${c.label}`,
    );
  }

  console.log("");
  console.log("AGGREGATE");
  console.log(`  schemaValidity   ${pct(a.schemaValidityRate)}`);
  console.log(`  scoreInRange     ${pct(a.scoreInRangeRate)}`);
  console.log(`  scoreSanity      ${pct(a.scoreSanityRate)}`);
  console.log(`  skillCoverage    ${a.skillCoverage.toFixed(3)}`);
  console.log(`  mustNotGap viol  ${pct(a.mustNotGapViolationRate)}`);
  console.log(`  judge avg        ${a.judgeAvg.toFixed(3)}`);
  console.log(
    `  latency p50/p95  ${a.p50LatencyMs}ms / ${a.p95LatencyMs}ms`,
  );
  console.log(
    `  tokens avg in/out  ${Math.round(a.avgTokensIn)} / ${Math.round(a.avgTokensOut)}`,
  );
  console.log("");
}
