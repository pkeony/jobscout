import { z } from "zod";
import { streamToJson } from "@/lib/ai/stream";
import type { ModelId } from "@/lib/ai/types";
import { INTERVIEW_RESPONSE_SCHEMA } from "@/lib/ai/schemas";
import {
  INTERVIEW_SYSTEM_PROMPT,
  PROMPT_VERSION as INTERVIEW_PROMPT_VERSION,
  buildInterviewMessages,
  extractInterviewJson,
  normalizeInterview,
} from "@/lib/prompts/interview";
import type { InterviewQuestion, InterviewResult } from "@/types";
import { InterviewQuestionSchema } from "@/types";
import { loadGoldset } from "../goldset";
import { judgeInterview } from "../judges/interview";
import {
  evaluateInterviewRules,
  summarizeInterviewRules,
} from "../rules/interview";
import {
  InterviewGoldsetSchema,
  type InterviewAggregate,
  type InterviewCaseReport,
  type InterviewEvalReport,
  type InterviewGoldsetCase,
  type InterviewRuleScore,
} from "../types";

const EMPTY_RULES: InterviewRuleScore = {
  schemaValidity: false,
  preTechnicalCount: 0,
  preBehavioralCount: 0,
  preSituationalCount: 0,
  preTipsCount: 0,
  categoryDistributionExact: false,
  categoryOrderValid: false,
  avgSampleAnswerSentences: 0,
  sampleAnswerAvgValid: false,
  profileSkillMentionCount: 0,
  profileSkillTotal: 0,
  duplicateQuestionPairs: 0,
};

const RawQuestionArraySchema = z.array(InterviewQuestionSchema);

interface RawOutput {
  questions: InterviewQuestion[];
  tips: string[];
  rawTechnical: number;
  rawBehavioral: number;
  rawSituational: number;
  rawOther: number;
  rawTipsCount: number;
}

function parseRawOutput(fullText: string): RawOutput | null {
  let cleaned = fullText.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const bag = parsed as { questions?: unknown; tips?: unknown };
  const qArr = RawQuestionArraySchema.safeParse(bag.questions);
  const tArr = z.array(z.string()).safeParse(bag.tips);
  if (!qArr.success || !tArr.success) return null;

  const counts = {
    technical: 0,
    behavioral: 0,
    situational: 0,
    other: 0,
  };
  for (const q of qArr.data) {
    if (q.category === "technical") counts.technical++;
    else if (q.category === "behavioral") counts.behavioral++;
    else if (q.category === "situational") counts.situational++;
    else counts.other++;
  }

  return {
    questions: qArr.data,
    tips: tArr.data,
    rawTechnical: counts.technical,
    rawBehavioral: counts.behavioral,
    rawSituational: counts.situational,
    rawOther: counts.other,
    rawTipsCount: tArr.data.length,
  };
}

export async function runInterviewCase(
  apiKey: string,
  case_: InterviewGoldsetCase,
  model: ModelId,
): Promise<InterviewCaseReport> {
  const startMs = Date.now();
  const messages = buildInterviewMessages(case_.jdText, {
    profile: case_.profile,
    analysisResult: case_.analysisResult,
    focusPosition: case_.focusPosition,
  });

  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let streamError: string | undefined;

  // streamToJson 은 refine failure 시 throw. raw 텍스트 확보 후 단계별 파싱.
  try {
    const draft = await streamToJson<string>(
      apiKey,
      messages,
      {
        model,
        system: INTERVIEW_SYSTEM_PROMPT,
        temperature: 0.5,
        maxTokens: 8192,
        responseJson: { schema: INTERVIEW_RESPONSE_SCHEMA },
      },
      (raw) => raw,
    );
    fullText = draft.result;
    tokensIn = draft.tokensIn;
    tokensOut = draft.tokensOut;
  } catch (err) {
    streamError = err instanceof Error ? err.message : String(err);
  }

  const latencyMs = Date.now() - startMs;
  const raw = fullText ? parseRawOutput(fullText) : null;

  if (!raw) {
    return {
      caseId: case_.id,
      label: case_.label,
      model,
      target: "interview",
      latencyMs,
      tokensIn,
      tokensOut,
      result: null,
      rawOutput: fullText.slice(0, 500),
      rules: EMPTY_RULES,
      judge: null,
      error: streamError ?? "interview 결과 raw 파싱 실패",
    };
  }

  // 후속: refine 통과용 result 생성(normalize + Zod parse). 분포 불충족이면 null.
  let result: InterviewResult | null = null;
  try {
    result = extractInterviewJson(fullText);
  } catch {
    try {
      const normalized = normalizeInterview({
        questions: raw.questions,
        tips: raw.tips,
      } as InterviewResult);
      // normalizeInterview 는 refine 을 걸지 않으므로 재파싱으로 최종 검증
      const { InterviewResultSchema } = await import("@/types");
      result = InterviewResultSchema.parse(normalized);
    } catch (err) {
      streamError =
        streamError ?? (err instanceof Error ? err.message : String(err));
    }
  }

  const rulePartial = evaluateInterviewRules(
    {
      questions: raw.questions,
      tips: raw.tips,
      rawCounts: {
        technical: raw.rawTechnical,
        behavioral: raw.rawBehavioral,
        situational: raw.rawSituational,
        other: raw.rawOther,
      },
      rawTipsCount: raw.rawTipsCount,
      profile: case_.profile ?? null,
    },
    case_.expected,
  );
  const rules: InterviewRuleScore = {
    schemaValidity: result !== null,
    ...rulePartial,
  };

  let judge: InterviewCaseReport["judge"] = null;
  if (result !== null) {
    try {
      judge = await judgeInterview(case_, result);
    } catch (err) {
      streamError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    caseId: case_.id,
    label: case_.label,
    model,
    target: "interview",
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

export function computeInterviewAggregate(
  reports: InterviewCaseReport[],
): InterviewAggregate {
  const total = reports.length || 1;
  const schemaValidityRate =
    reports.filter((r) => r.rules.schemaValidity).length / total;
  const categoryDistributionExactRate =
    reports.filter((r) => r.rules.categoryDistributionExact).length / total;
  const categoryOrderValidRate =
    reports.filter((r) => r.rules.categoryOrderValid).length / total;
  const sampleAnswerAvgValidRate =
    reports.filter((r) => r.rules.sampleAnswerAvgValid).length / total;
  const avgSampleAnswerSentences =
    reports.reduce((s, r) => s + r.rules.avgSampleAnswerSentences, 0) / total;

  const mentionHits = reports.reduce(
    (s, r) => s + r.rules.profileSkillMentionCount,
    0,
  );
  const mentionTotals = reports.reduce(
    (s, r) => s + r.rules.profileSkillTotal,
    0,
  );
  const profileSkillMentionCoverage =
    mentionTotals > 0 ? mentionHits / mentionTotals : 0;

  const avgDuplicateQuestionPairs =
    reports.reduce((s, r) => s + r.rules.duplicateQuestionPairs, 0) / total;

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
    categoryDistributionExactRate,
    categoryOrderValidRate,
    sampleAnswerAvgValidRate,
    avgSampleAnswerSentences,
    profileSkillMentionCoverage,
    avgDuplicateQuestionPairs,
    judgeAvg,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgTokensIn: tokensIn.reduce((s, v) => s + v, 0) / total,
    avgTokensOut: tokensOut.reduce((s, v) => s + v, 0) / total,
  };
}

export interface RunInterviewEvalOpts {
  goldsetPath: string;
  model: ModelId;
}

export async function runInterviewEval(
  opts: RunInterviewEvalOpts,
): Promise<InterviewEvalReport> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY가 설정되지 않았습니다.");
  }

  const cases = await loadGoldset(opts.goldsetPath, InterviewGoldsetSchema);
  console.log(
    `[eval·interview] ${cases.length}개 case 로드 · model=${opts.model}`,
  );

  const reports: InterviewCaseReport[] = [];
  for (const case_ of cases) {
    const start = Date.now();
    const report = await runInterviewCase(apiKey, case_, opts.model);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const judgePart =
      report.judge !== null
        ? `judge=${report.judge.score.toFixed(2)}`
        : "judge=skipped";
    const errPart = report.error ? ` ERROR=${report.error.slice(0, 80)}` : "";
    console.log(
      `[${case_.id}] ${summarizeInterviewRules(report.rules)} ${judgePart} (${elapsed}s)${errPart}`,
    );
    reports.push(report);
  }

  return {
    runId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    target: "interview",
    model: opts.model,
    promptVersion: INTERVIEW_PROMPT_VERSION,
    caseCount: cases.length,
    cases: reports,
    aggregate: computeInterviewAggregate(reports),
  };
}

export function printInterviewReport(report: InterviewEvalReport): void {
  const a = report.aggregate;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  console.log("");
  console.log(
    `=== EVAL REPORT (interview) · ${report.runId} · ${report.model} ===`,
  );
  console.log(
    `cases: ${report.caseCount}  started: ${report.startedAt}  promptVersion: ${report.promptVersion ?? "n/a"}`,
  );
  console.log("");

  for (const c of report.cases) {
    const judgePart =
      c.judge !== null ? `judge=${c.judge.score.toFixed(2)}` : "judge=skipped";
    console.log(
      `  ${c.caseId.padEnd(8)} ${summarizeInterviewRules(c.rules)} ${judgePart}  ${c.label}`,
    );
  }

  console.log("");
  console.log("AGGREGATE");
  console.log(`  schemaValidity          ${pct(a.schemaValidityRate)}`);
  console.log(`  categoryDistExact       ${pct(a.categoryDistributionExactRate)}`);
  console.log(`  categoryOrderValid      ${pct(a.categoryOrderValidRate)}`);
  console.log(`  sampleAnswer avg-valid  ${pct(a.sampleAnswerAvgValidRate)} (avg ${a.avgSampleAnswerSentences.toFixed(1)})`);
  console.log(`  profileSkillMention     ${a.profileSkillMentionCoverage.toFixed(3)}`);
  console.log(`  avg duplicate pairs     ${a.avgDuplicateQuestionPairs.toFixed(2)}`);
  console.log(`  judge avg               ${a.judgeAvg.toFixed(3)}`);
  console.log(
    `  latency p50/p95         ${a.p50LatencyMs}ms / ${a.p95LatencyMs}ms`,
  );
  console.log(
    `  tokens avg in/out       ${Math.round(a.avgTokensIn)} / ${Math.round(a.avgTokensOut)}`,
  );
  console.log("");
}
