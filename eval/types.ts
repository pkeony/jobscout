import { z } from "zod";
import {
  AnalysisResultSchema,
  MatchResultSchema,
  UserProfileSchema,
} from "@/types";

// ─── 골든셋 case ─────────────────────────────────────

export const GoldsetCaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  jdText: z.string(),
  analysisResult: AnalysisResultSchema,
  profile: UserProfileSchema,
  focusPosition: z.string().optional(),
  expected: z.object({
    scoreRange: z.tuple([z.number(), z.number()]),
    mustMatch: z.array(z.string()).default([]),
    mustNotGap: z.array(z.string()).default([]),
    judgeRubric: z.string(),
  }),
});
export type GoldsetCase = z.infer<typeof GoldsetCaseSchema>;

// ─── 개별 case 결과 ─────────────────────────────────

export const RuleScoreSchema = z.object({
  schemaValidity: z.boolean(),
  scoreInRange: z.boolean(),
  scoreSanity: z.boolean(),
  mustMatchHits: z.number(),
  mustMatchTotal: z.number(),
  mustNotGapViolations: z.number(),
});
export type RuleScore = z.infer<typeof RuleScoreSchema>;

export const JudgeScoreSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string(),
});
export type JudgeScore = z.infer<typeof JudgeScoreSchema>;

export const CaseReportSchema = z.object({
  caseId: z.string(),
  label: z.string(),
  model: z.string(),
  latencyMs: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  result: MatchResultSchema.nullable(), // 스키마 파싱 실패 시 null
  rawOutput: z.string().optional(), // 파싱 실패 디버깅용
  rules: RuleScoreSchema,
  judge: JudgeScoreSchema.nullable(), // rule schemaValidity 실패 시 judge 스킵
  error: z.string().optional(),
});
export type CaseReport = z.infer<typeof CaseReportSchema>;

// ─── 집계 리포트 ─────────────────────────────────────

export const AggregateSchema = z.object({
  schemaValidityRate: z.number(),
  scoreInRangeRate: z.number(),
  scoreSanityRate: z.number(),
  skillCoverage: z.number(), // mustMatchHits 합 / mustMatchTotal 합
  mustNotGapViolationRate: z.number(),
  judgeAvg: z.number(),
  p50LatencyMs: z.number(),
  p95LatencyMs: z.number(),
  avgTokensIn: z.number(),
  avgTokensOut: z.number(),
});
export type Aggregate = z.infer<typeof AggregateSchema>;

export const EvalReportSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  model: z.string(),
  promptVersion: z.string().optional(),
  caseCount: z.number(),
  cases: z.array(CaseReportSchema),
  aggregate: AggregateSchema,
});
export type EvalReport = z.infer<typeof EvalReportSchema>;
