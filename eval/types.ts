import { z } from "zod";
import {
  AnalysisResultSchema,
  MatchResultSchema,
  UserProfileSchema,
} from "@/types";

// ─── 공통 베이스 (입력 파트) ──────────────────────────

const GoldsetBaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  jdText: z.string(),
  analysisResult: AnalysisResultSchema,
  profile: UserProfileSchema,
  focusPosition: z.string().optional(),
});

// ─── match target ─────────────────────────────────────

export const MatchExpectedSchema = z.object({
  scoreRange: z.tuple([z.number(), z.number()]),
  mustMatch: z.array(z.string()).default([]),
  mustNotGap: z.array(z.string()).default([]),
  judgeRubric: z.string(),
});
export type MatchExpected = z.infer<typeof MatchExpectedSchema>;

export const MatchGoldsetSchema = GoldsetBaseSchema.extend({
  target: z.literal("match"),
  expected: MatchExpectedSchema,
});
export type MatchGoldsetCase = z.infer<typeof MatchGoldsetSchema>;

// ─── analyze target ───────────────────────────────────

export const FORBIDDEN_DOMAIN_VALUES = [
  "llm",
  "cv",
  "traditional-ml",
  "data-eng",
] as const;

export const AnalyzeExpectedSchema = z.object({
  mustHaveSkills: z.array(z.string()).default([]),
  mustHavePreferredSkills: z.array(z.string()).default([]),
  forbiddenDomains: z.array(z.enum(FORBIDDEN_DOMAIN_VALUES)).default([]),
  maxSkills: z.number().default(25),
  judgeRubric: z.string(),
});
export type AnalyzeExpected = z.infer<typeof AnalyzeExpectedSchema>;

export const AnalyzeGoldsetSchema = GoldsetBaseSchema.extend({
  target: z.literal("analyze"),
  expected: AnalyzeExpectedSchema,
});
export type AnalyzeGoldsetCase = z.infer<typeof AnalyzeGoldsetSchema>;

// ─── cover-letter / interview target (다음 세션 확정) ─

export const CoverLetterGoldsetSchema = GoldsetBaseSchema.extend({
  target: z.literal("cover-letter"),
  expected: z.unknown(),
});
export type CoverLetterGoldsetCase = z.infer<typeof CoverLetterGoldsetSchema>;

export const InterviewGoldsetSchema = GoldsetBaseSchema.extend({
  target: z.literal("interview"),
  expected: z.unknown(),
});
export type InterviewGoldsetCase = z.infer<typeof InterviewGoldsetSchema>;

// ─── discriminated union ──────────────────────────────

export const GoldsetCaseSchema = z.discriminatedUnion("target", [
  MatchGoldsetSchema,
  AnalyzeGoldsetSchema,
  CoverLetterGoldsetSchema,
  InterviewGoldsetSchema,
]);
export type GoldsetCase = z.infer<typeof GoldsetCaseSchema>;

export type EvalTarget = GoldsetCase["target"];

// ─── Rule scores (target 별) ──────────────────────────

export const MatchRuleScoreSchema = z.object({
  schemaValidity: z.boolean(),
  scoreInRange: z.boolean(),
  scoreSanity: z.boolean(),
  mustMatchHits: z.number(),
  mustMatchTotal: z.number(),
  mustNotGapViolations: z.number(),
});
export type MatchRuleScore = z.infer<typeof MatchRuleScoreSchema>;

export const AnalyzeRuleScoreSchema = z.object({
  schemaValidity: z.boolean(),
  skillsInRange: z.boolean(),
  categoryEnumValid: z.boolean(),
  mustHaveHits: z.number(),
  mustHaveTotal: z.number(),
  mustHavePreferredHits: z.number(),
  mustHavePreferredTotal: z.number(),
  companyInfoPresent: z.boolean(),
  domainIntrusionCount: z.number(),
});
export type AnalyzeRuleScore = z.infer<typeof AnalyzeRuleScoreSchema>;

// ─── Judge score (공통) ───────────────────────────────

export const JudgeScoreSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string(),
});
export type JudgeScore = z.infer<typeof JudgeScoreSchema>;

// ─── Case report (target 별) ──────────────────────────

export const MatchCaseReportSchema = z.object({
  caseId: z.string(),
  label: z.string(),
  model: z.string(),
  target: z.literal("match"),
  latencyMs: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  result: MatchResultSchema.nullable(),
  rawOutput: z.string().optional(),
  rules: MatchRuleScoreSchema,
  judge: JudgeScoreSchema.nullable(),
  error: z.string().optional(),
});
export type MatchCaseReport = z.infer<typeof MatchCaseReportSchema>;

export const AnalyzeCaseReportSchema = z.object({
  caseId: z.string(),
  label: z.string(),
  model: z.string(),
  target: z.literal("analyze"),
  latencyMs: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  result: AnalysisResultSchema.nullable(),
  rawOutput: z.string().optional(),
  rules: AnalyzeRuleScoreSchema,
  judge: JudgeScoreSchema.nullable(),
  error: z.string().optional(),
});
export type AnalyzeCaseReport = z.infer<typeof AnalyzeCaseReportSchema>;

export type CaseReport = MatchCaseReport | AnalyzeCaseReport;

// ─── Aggregate (target 별) ────────────────────────────

export const MatchAggregateSchema = z.object({
  schemaValidityRate: z.number(),
  scoreInRangeRate: z.number(),
  scoreSanityRate: z.number(),
  skillCoverage: z.number(),
  mustNotGapViolationRate: z.number(),
  judgeAvg: z.number(),
  p50LatencyMs: z.number(),
  p95LatencyMs: z.number(),
  avgTokensIn: z.number(),
  avgTokensOut: z.number(),
});
export type MatchAggregate = z.infer<typeof MatchAggregateSchema>;

export const AnalyzeAggregateSchema = z.object({
  schemaValidityRate: z.number(),
  skillsInRangeRate: z.number(),
  categoryEnumValidRate: z.number(),
  mustHaveCoverage: z.number(),
  mustHavePreferredCoverage: z.number(),
  companyInfoPresentRate: z.number(),
  domainIntrusionRate: z.number(),
  avgDomainIntrusionCount: z.number(),
  judgeAvg: z.number(),
  p50LatencyMs: z.number(),
  p95LatencyMs: z.number(),
  avgTokensIn: z.number(),
  avgTokensOut: z.number(),
});
export type AnalyzeAggregate = z.infer<typeof AnalyzeAggregateSchema>;

// ─── Eval report (target 별) ──────────────────────────

export const MatchEvalReportSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  target: z.literal("match"),
  model: z.string(),
  promptVersion: z.string().optional(),
  caseCount: z.number(),
  cases: z.array(MatchCaseReportSchema),
  aggregate: MatchAggregateSchema,
});
export type MatchEvalReport = z.infer<typeof MatchEvalReportSchema>;

export const AnalyzeEvalReportSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  target: z.literal("analyze"),
  model: z.string(),
  promptVersion: z.string().optional(),
  caseCount: z.number(),
  cases: z.array(AnalyzeCaseReportSchema),
  aggregate: AnalyzeAggregateSchema,
});
export type AnalyzeEvalReport = z.infer<typeof AnalyzeEvalReportSchema>;

export const EvalReportSchema = z.discriminatedUnion("target", [
  MatchEvalReportSchema,
  AnalyzeEvalReportSchema,
]);
export type EvalReport = z.infer<typeof EvalReportSchema>;
