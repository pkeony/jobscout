import { z } from "zod";

// ─── Skill ──────────────────────────────────────────

export const SkillCategorySchema = z.enum(["required", "preferred", "etc"]).catch("etc");
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const SkillLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "unspecified",
]).catch("unspecified");
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const SkillSchema = z.object({
  name: z.string(),
  category: SkillCategorySchema,
  level: SkillLevelSchema,
  context: z.string().optional().default(""),
}).passthrough();
export type Skill = z.infer<typeof SkillSchema>;

// ─── CompanyInfo ────────────────────────────────────

export const CompanyInfoSchema = z.object({
  name: z.string().optional().default("회사명 미확인"),
  industry: z.string().optional(),
  size: z.string().optional(),
  culture: z.array(z.string()).optional().default([]),
}).passthrough();
export type CompanyInfo = z.infer<typeof CompanyInfoSchema>;

// ─── AnalysisResult ─────────────────────────────────

export const AnalysisResultSchema = z.object({
  skills: z.array(SkillSchema).optional().default([]),
  summary: z.string().optional().default(""),
  roleTitle: z.string().optional().default("직무명 미확인"),
  experienceLevel: z.string().optional().default("미확인"),
  companyInfo: CompanyInfoSchema.optional().default({ name: "회사명 미확인", culture: [] }),
  keyResponsibilities: z.array(z.string()).optional().default([]),
  requirements: z.array(z.string()).optional().default([]),
  preferredRequirements: z.array(z.string()).optional().default([]),
  benefits: z.array(z.string()).optional().default([]),
}).passthrough();
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ─── CrawlResult ────────────────────────────────────

export const CrawlResultSchema = z.object({
  title: z.string(),
  company: z.string(),
  text: z.string(),
  url: z.string(),
});
export type CrawlResult = z.infer<typeof CrawlResultSchema>;

// ─── UserProfile ────────────────────────────────────

export const UserProfileSchema = z.object({
  skills: z.array(z.string()),
  experience: z.string(),
  education: z.string().optional(),
  introduction: z.string().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ─── MatchResult ────────────────────────────────────

export const SkillMatchSchema = z.object({
  name: z.string(),
  status: z.enum(["match", "partial", "gap"]),
  comment: z.string(),
});
export type SkillMatch = z.infer<typeof SkillMatchSchema>;

export const ScoreBucketSchema = z.object({
  earned: z.number().min(0),
  max: z.number().min(0),
});
export type ScoreBucket = z.infer<typeof ScoreBucketSchema>;

export const ScoreBreakdownSchema = z.object({
  requiredSkills: ScoreBucketSchema,
  preferredSkills: ScoreBucketSchema,
  experience: ScoreBucketSchema,
  base: z.number().min(0),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const MatchResultSchema = z.object({
  score: z.number().min(0).max(100),
  scoreBreakdown: ScoreBreakdownSchema.optional(),
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  skillMatches: z.array(SkillMatchSchema),
  advice: z.string(),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

// ─── InterviewResult ────────────────────────────────

export const InterviewQuestionSchema = z.object({
  question: z.string(),
  category: z.enum(["technical", "behavioral", "situational"]),
  intent: z.string(),
  sampleAnswer: z.string(),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;

export const InterviewResultSchema = z.object({
  questions: z.array(InterviewQuestionSchema),
  tips: z.array(z.string()),
});
export type InterviewResult = z.infer<typeof InterviewResultSchema>;

// ─── API Request Schemas ────────────────────────────

export const CrawlRequestSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요"),
});
export type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

export const AnalyzeRequestSchema = z.object({
  text: z.string().min(50, "JD 텍스트는 최소 50자 이상이어야 합니다"),
  focusPosition: z.string().optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const MatchRequestSchema = z.object({
  jdText: z.string().min(50, "JD 텍스트는 최소 50자 이상이어야 합니다"),
  profile: UserProfileSchema,
  analysisResult: AnalysisResultSchema.optional(),
  focusPosition: z.string().optional(),
});
export type MatchRequest = z.infer<typeof MatchRequestSchema>;

export const CoverLetterRequestSchema = z.object({
  jdText: z.string().min(50, "JD 텍스트는 최소 50자 이상이어야 합니다"),
  profile: UserProfileSchema,
  analysisResult: AnalysisResultSchema.optional(),
  focusPosition: z.string().optional(),
});
export type CoverLetterRequest = z.infer<typeof CoverLetterRequestSchema>;

export const InterviewRequestSchema = z.object({
  jdText: z.string().min(50, "JD 텍스트는 최소 50자 이상이어야 합니다"),
  analysisResult: AnalysisResultSchema.optional(),
  focusPosition: z.string().optional(),
});
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;
