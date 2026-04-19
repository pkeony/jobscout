import { z } from "zod";
import {
  AnalysisResultSchema,
  CoverLetterRefineResultSchema,
  CoverLetterResultSchema,
  CoverLetterTraceResultSchema,
  InterviewResultSchema,
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
  minSkills: z.number().default(1),
  maxSkills: z.number().default(25),
  judgeRubric: z.string(),
});
export type AnalyzeExpected = z.infer<typeof AnalyzeExpectedSchema>;

export const AnalyzeGoldsetSchema = GoldsetBaseSchema.extend({
  target: z.literal("analyze"),
  expected: AnalyzeExpectedSchema,
});
export type AnalyzeGoldsetCase = z.infer<typeof AnalyzeGoldsetSchema>;

// ─── cover-letter target ──────────────────────────────

export const COVER_LETTER_REQUIRED_HEADINGS = [
  "지원 동기",
  "핵심 역량",
  "성장 경험",
  "입사 후 포부",
] as const;

export const CoverLetterExpectedSchema = z.object({
  requiredHeadings: z
    .array(z.string())
    .default([...COVER_LETTER_REQUIRED_HEADINGS]),
  minParagraphsPerSection: z.number().default(2),
  maxParagraphsPerSection: z.number().default(3),
  expectedCompanyName: z.string().optional(),
  judgeRubric: z.string(),
});
export type CoverLetterExpected = z.infer<typeof CoverLetterExpectedSchema>;

export const CoverLetterGoldsetSchema = GoldsetBaseSchema.extend({
  target: z.literal("cover-letter"),
  expected: CoverLetterExpectedSchema,
});
export type CoverLetterGoldsetCase = z.infer<typeof CoverLetterGoldsetSchema>;

// ─── interview target ─────────────────────────────────

export const InterviewExpectedSchema = z.object({
  questionsTotal: z.number().default(10),
  technicalCount: z.number().default(5),
  behavioralCount: z.number().default(3),
  situationalCount: z.number().default(2),
  tipsCount: z.number().default(4),
  minSampleAnswerSentences: z.number().default(3),
  maxSampleAnswerSentences: z.number().default(5),
  minProfileSkillMentionRate: z.number().default(0),
  judgeRubric: z.string(),
});
export type InterviewExpected = z.infer<typeof InterviewExpectedSchema>;

export const InterviewGoldsetSchema = GoldsetBaseSchema.extend({
  target: z.literal("interview"),
  expected: InterviewExpectedSchema,
});
export type InterviewGoldsetCase = z.infer<typeof InterviewGoldsetSchema>;

// ─── cover-letter-trace target (피처 D) ──────────────

export const CoverLetterTraceExpectedSchema = z.object({
  // v0/v1 채점은 cover-letter expected 필드 그대로 재사용
  requiredHeadings: z
    .array(z.string())
    .default([...COVER_LETTER_REQUIRED_HEADINGS]),
  minParagraphsPerSection: z.number().default(2),
  maxParagraphsPerSection: z.number().default(3),
  expectedCompanyName: z.string().optional(),
  judgeRubric: z.string(),
  // trace 자체 검증
  minWeaknessCount: z.number().default(3),
  maxWeaknessCount: z.number().default(8),
});
export type CoverLetterTraceExpected = z.infer<typeof CoverLetterTraceExpectedSchema>;

export const CoverLetterTraceGoldsetSchema = GoldsetBaseSchema.extend({
  target: z.literal("cover-letter-trace"),
  coverLetterV0: CoverLetterResultSchema,
  interviewResult: InterviewResultSchema,
  expected: CoverLetterTraceExpectedSchema,
});
export type CoverLetterTraceGoldsetCase = z.infer<typeof CoverLetterTraceGoldsetSchema>;

// ─── discriminated union ──────────────────────────────

export const GoldsetCaseSchema = z.discriminatedUnion("target", [
  MatchGoldsetSchema,
  AnalyzeGoldsetSchema,
  CoverLetterGoldsetSchema,
  InterviewGoldsetSchema,
  CoverLetterTraceGoldsetSchema,
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
  hallucinatedSkillCount: z.number(),
  totalSkillCount: z.number(),
});
export type AnalyzeRuleScore = z.infer<typeof AnalyzeRuleScoreSchema>;

export const CoverLetterRuleScoreSchema = z.object({
  schemaValidity: z.boolean(),
  sectionCount: z.number(),
  headingsMatched: z.number(),
  headingsTotal: z.number(),
  paragraphCountValid: z.boolean(),
  companyNamePresent: z.boolean(),
  jobTitlePresent: z.boolean(),
  starKeywordCount: z.number(),
  starLabelCount: z.number(),
  starLabelFullySatisfiedSections: z.number(),
});
export type CoverLetterRuleScore = z.infer<typeof CoverLetterRuleScoreSchema>;

export const InterviewRuleScoreSchema = z.object({
  schemaValidity: z.boolean(),
  preTechnicalCount: z.number(),
  preBehavioralCount: z.number(),
  preSituationalCount: z.number(),
  preTipsCount: z.number(),
  categoryDistributionExact: z.boolean(),
  categoryOrderValid: z.boolean(),
  avgSampleAnswerSentences: z.number(),
  sampleAnswerAvgValid: z.boolean(),
  profileSkillMentionCount: z.number(),
  profileSkillTotal: z.number(),
  duplicateQuestionPairs: z.number(),
});
export type InterviewRuleScore = z.infer<typeof InterviewRuleScoreSchema>;

export const CoverLetterTraceRuleScoreSchema = z.object({
  schemaValidity: z.boolean(),
  // trace 자체
  weaknessCount: z.number(),
  weaknessCountInRange: z.boolean(),
  evidenceQuestionMatchRate: z.number(),
  evidenceLinkRate: z.number(),
  relatedHeadingValidRate: z.number(),
  // refine 자체
  refineSchemaValidity: z.boolean(),
  appliedWeaknessRate: z.number(),
  changeNotesPerWeakness: z.number(),
  // v0 vs v1 cover-letter rule (delta 는 aggregate 에서 계산)
  v0Rules: CoverLetterRuleScoreSchema,
  v1Rules: CoverLetterRuleScoreSchema,
});
export type CoverLetterTraceRuleScore = z.infer<typeof CoverLetterTraceRuleScoreSchema>;

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

export const CoverLetterCaseReportSchema = z.object({
  caseId: z.string(),
  label: z.string(),
  model: z.string(),
  target: z.literal("cover-letter"),
  latencyMs: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  result: CoverLetterResultSchema.nullable(),
  rawOutput: z.string().optional(),
  rules: CoverLetterRuleScoreSchema,
  judge: JudgeScoreSchema.nullable(),
  error: z.string().optional(),
});
export type CoverLetterCaseReport = z.infer<typeof CoverLetterCaseReportSchema>;

export const InterviewCaseReportSchema = z.object({
  caseId: z.string(),
  label: z.string(),
  model: z.string(),
  target: z.literal("interview"),
  latencyMs: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  result: InterviewResultSchema.nullable(),
  rawOutput: z.string().optional(),
  rules: InterviewRuleScoreSchema,
  judge: JudgeScoreSchema.nullable(),
  error: z.string().optional(),
});
export type InterviewCaseReport = z.infer<typeof InterviewCaseReportSchema>;

export const CoverLetterTraceCaseReportSchema = z.object({
  caseId: z.string(),
  label: z.string(),
  model: z.string(),
  target: z.literal("cover-letter-trace"),
  latencyMs: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  traceResult: CoverLetterTraceResultSchema.nullable(),
  refineResult: CoverLetterRefineResultSchema.nullable(),
  rules: CoverLetterTraceRuleScoreSchema,
  v0Judge: JudgeScoreSchema.nullable(),
  v1Judge: JudgeScoreSchema.nullable(),
  judgeDelta: z.number().nullable(),
  error: z.string().optional(),
});
export type CoverLetterTraceCaseReport = z.infer<typeof CoverLetterTraceCaseReportSchema>;

export type CaseReport =
  | MatchCaseReport
  | AnalyzeCaseReport
  | CoverLetterCaseReport
  | InterviewCaseReport
  | CoverLetterTraceCaseReport;

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
  hallucinationRate: z.number(),
  avgHallucinatedSkillCount: z.number(),
  judgeAvg: z.number(),
  p50LatencyMs: z.number(),
  p95LatencyMs: z.number(),
  avgTokensIn: z.number(),
  avgTokensOut: z.number(),
});
export type AnalyzeAggregate = z.infer<typeof AnalyzeAggregateSchema>;

export const CoverLetterAggregateSchema = z.object({
  schemaValidityRate: z.number(),
  sectionCountExactRate: z.number(),
  headingsCoverage: z.number(),
  paragraphCountValidRate: z.number(),
  companyNamePresentRate: z.number(),
  jobTitlePresentRate: z.number(),
  avgStarKeywordCount: z.number(),
  avgStarLabelCount: z.number(),
  starLabelFullyCoveredRate: z.number(),
  judgeAvg: z.number(),
  p50LatencyMs: z.number(),
  p95LatencyMs: z.number(),
  avgTokensIn: z.number(),
  avgTokensOut: z.number(),
});
export type CoverLetterAggregate = z.infer<typeof CoverLetterAggregateSchema>;

export const InterviewAggregateSchema = z.object({
  schemaValidityRate: z.number(),
  categoryDistributionExactRate: z.number(),
  categoryOrderValidRate: z.number(),
  sampleAnswerAvgValidRate: z.number(),
  avgSampleAnswerSentences: z.number(),
  profileSkillMentionCoverage: z.number(),
  avgDuplicateQuestionPairs: z.number(),
  judgeAvg: z.number(),
  p50LatencyMs: z.number(),
  p95LatencyMs: z.number(),
  avgTokensIn: z.number(),
  avgTokensOut: z.number(),
});
export type InterviewAggregate = z.infer<typeof InterviewAggregateSchema>;

export const CoverLetterTraceAggregateSchema = z.object({
  // trace 자체
  schemaValidityRate: z.number(),
  weaknessCountInRangeRate: z.number(),
  avgWeaknessCount: z.number(),
  avgEvidenceQuestionMatchRate: z.number(),
  avgEvidenceLinkRate: z.number(),
  avgRelatedHeadingValidRate: z.number(),
  // refine 자체
  refineSchemaValidityRate: z.number(),
  avgAppliedWeaknessRate: z.number(),
  avgChangeNotesPerWeakness: z.number(),
  // v0/v1 delta (primary KPI)
  judgeAvgV0: z.number(),
  judgeAvgV1: z.number(),
  judgeDelta: z.number(),
  improvedRate: z.number(),
  headingsCoverageDelta: z.number(),
  starLabelCountDelta: z.number(),
  starLabelFullyCoveredDelta: z.number(),
  // perf
  p50LatencyMs: z.number(),
  p95LatencyMs: z.number(),
  avgTokensIn: z.number(),
  avgTokensOut: z.number(),
});
export type CoverLetterTraceAggregate = z.infer<typeof CoverLetterTraceAggregateSchema>;

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

export const CoverLetterEvalReportSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  target: z.literal("cover-letter"),
  model: z.string(),
  promptVersion: z.string().optional(),
  caseCount: z.number(),
  cases: z.array(CoverLetterCaseReportSchema),
  aggregate: CoverLetterAggregateSchema,
});
export type CoverLetterEvalReport = z.infer<typeof CoverLetterEvalReportSchema>;

export const InterviewEvalReportSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  target: z.literal("interview"),
  model: z.string(),
  promptVersion: z.string().optional(),
  caseCount: z.number(),
  cases: z.array(InterviewCaseReportSchema),
  aggregate: InterviewAggregateSchema,
});
export type InterviewEvalReport = z.infer<typeof InterviewEvalReportSchema>;

export const CoverLetterTraceEvalReportSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  target: z.literal("cover-letter-trace"),
  model: z.string(),
  promptVersion: z.string().optional(),
  refinePromptVersion: z.string().optional(),
  caseCount: z.number(),
  cases: z.array(CoverLetterTraceCaseReportSchema),
  aggregate: CoverLetterTraceAggregateSchema,
});
export type CoverLetterTraceEvalReport = z.infer<typeof CoverLetterTraceEvalReportSchema>;

export const EvalReportSchema = z.discriminatedUnion("target", [
  MatchEvalReportSchema,
  AnalyzeEvalReportSchema,
  CoverLetterEvalReportSchema,
  InterviewEvalReportSchema,
  CoverLetterTraceEvalReportSchema,
]);
export type EvalReport = z.infer<typeof EvalReportSchema>;
