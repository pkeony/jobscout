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

// ─── ProfileSlot (멀티 슬롯 + 라벨) ─────────────────

export const ProfileSlotSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(40),
  profile: UserProfileSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ProfileSlot = z.infer<typeof ProfileSlotSchema>;

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

// ─── AnalyzeHistoryEntry ────────────────────────────

export const AnalyzeHistoryEntrySchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  jobUrl: z.string().optional(),
  focusPosition: z.string().optional(),
  savedAt: z.number(),
  jdText: z.string(),
  analysisResult: AnalysisResultSchema,
});
export type AnalyzeHistoryEntry = z.infer<typeof AnalyzeHistoryEntrySchema>;

// ─── MatchHistoryEntry ──────────────────────────────

export const MatchHistoryEntrySchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  jobUrl: z.string().optional(),
  focusPosition: z.string().optional(),
  profileLabel: z.string(),
  savedAt: z.number(),
  jdText: z.string(),
  matchResult: MatchResultSchema,
  analysisResult: AnalysisResultSchema.optional(),
});
export type MatchHistoryEntry = z.infer<typeof MatchHistoryEntrySchema>;

// ─── CoverLetterResult (JSON) ────────────────────────

export const CoverLetterSectionSchema = z.object({
  heading: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(1),
});
export type CoverLetterSection = z.infer<typeof CoverLetterSectionSchema>;

export const CoverLetterResultSchema = z.object({
  companyName: z.string(),
  jobTitle: z.string(),
  sections: z.array(CoverLetterSectionSchema).min(3).max(6),
});
export type CoverLetterResult = z.infer<typeof CoverLetterResultSchema>;

// ─── ImproveCoverLetterResult (JSON) ─────────────────

export const ImproveSuggestionSchema = z.object({
  heading: z.string(),
  original: z.string(),
  revised: z.string(),
  reason: z.string(),
});
export type ImproveSuggestion = z.infer<typeof ImproveSuggestionSchema>;

export const ImproveCoverLetterResultSchema = z.object({
  overallComment: z.string(),
  suggestions: z.array(ImproveSuggestionSchema).min(1),
  missingFromJd: z.array(z.string()),
  revised: CoverLetterResultSchema,
});
export type ImproveCoverLetterResult = z.infer<typeof ImproveCoverLetterResultSchema>;

// ─── InterviewResult ────────────────────────────────

export const InterviewQuestionSchema = z.object({
  question: z.string(),
  category: z.enum(["technical", "behavioral", "situational"]),
  intent: z.string(),
  sampleAnswer: z.string(),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;

// 개수 분포 불변식: technical 5 / behavioral 3 / situational 2, tips 4
// SDK responseSchema + 프롬프트 셀프체크가 1차, 이 refine이 최종 방어선.
export const InterviewResultSchema = z
  .object({
    questions: z.array(InterviewQuestionSchema).length(10),
    tips: z.array(z.string()).length(4),
  })
  .refine(
    (r) => {
      const t = r.questions.filter((q) => q.category === "technical").length;
      const b = r.questions.filter((q) => q.category === "behavioral").length;
      const s = r.questions.filter((q) => q.category === "situational").length;
      return t === 5 && b === 3 && s === 2;
    },
    {
      message: "면접 질문 카테고리 분포는 technical 5, behavioral 3, situational 2이어야 합니다",
    },
  );
export type InterviewResult = z.infer<typeof InterviewResultSchema>;

// ─── CoverLetterHistoryEntry ────────────────────────

export const CoverLetterHistoryEntrySchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  jobUrl: z.string().optional(),
  focusPosition: z.string().optional(),
  profileLabel: z.string(),
  savedAt: z.number(),
  jdText: z.string(),
  coverLetterResult: CoverLetterResultSchema,
  analysisResult: AnalysisResultSchema.optional(),
});
export type CoverLetterHistoryEntry = z.infer<typeof CoverLetterHistoryEntrySchema>;

// ─── InterviewHistoryEntry ──────────────────────────

export const InterviewHistoryEntrySchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  jobUrl: z.string().optional(),
  focusPosition: z.string().optional(),
  savedAt: z.number(),
  jdText: z.string(),
  interviewResult: InterviewResultSchema,
  analysisResult: AnalysisResultSchema.optional(),
});
export type InterviewHistoryEntry = z.infer<typeof InterviewHistoryEntrySchema>;

// ─── API Request Schemas ────────────────────────────

export const CrawlRequestSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요"),
});
export type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

export const AnalyzeRequestSchema = z.object({
  text: z.string().min(50, "채용공고 텍스트는 최소 50자 이상이어야 합니다"),
  focusPosition: z.string().optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const MatchRequestSchema = z.object({
  jdText: z.string().min(50, "채용공고 텍스트는 최소 50자 이상이어야 합니다"),
  profile: UserProfileSchema,
  analysisResult: AnalysisResultSchema.optional(),
  focusPosition: z.string().optional(),
});
export type MatchRequest = z.infer<typeof MatchRequestSchema>;

export const CoverLetterRequestSchema = z.object({
  jdText: z.string().min(50, "채용공고 텍스트는 최소 50자 이상이어야 합니다"),
  profile: UserProfileSchema,
  analysisResult: AnalysisResultSchema.optional(),
  focusPosition: z.string().optional(),
});
export type CoverLetterRequest = z.infer<typeof CoverLetterRequestSchema>;

export const InterviewRequestSchema = z.object({
  jdText: z.string().min(50, "채용공고 텍스트는 최소 50자 이상이어야 합니다"),
  profile: UserProfileSchema.optional(),
  analysisResult: AnalysisResultSchema.optional(),
  focusPosition: z.string().optional(),
});
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;

// ─── CoverLetterTrace / Refine (피처 D: 자소서↔면접 역추적) ──

export const CoverLetterWeaknessSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  evidenceQuestion: z.string().min(1),
  evidenceIntent: z.string().min(1),
  suggestion: z.string().min(1),
  relatedHeading: z.string().optional(),
});
export type CoverLetterWeakness = z.infer<typeof CoverLetterWeaknessSchema>;

export const CoverLetterTraceResultSchema = z.object({
  weaknesses: z.array(CoverLetterWeaknessSchema).min(3).max(8),
  overallDiagnosis: z.string().min(1),
});
export type CoverLetterTraceResult = z.infer<typeof CoverLetterTraceResultSchema>;

export const CoverLetterTraceRequestSchema = z.object({
  coverLetter: CoverLetterResultSchema,
  interviewResult: InterviewResultSchema,
  jdText: z.string().min(50, "채용공고 텍스트는 최소 50자 이상이어야 합니다"),
  profile: UserProfileSchema.optional(),
  analysisResult: AnalysisResultSchema.optional(),
  focusPosition: z.string().optional(),
});
export type CoverLetterTraceRequest = z.infer<typeof CoverLetterTraceRequestSchema>;

export const CoverLetterRefineRequestSchema = CoverLetterTraceRequestSchema.extend({
  weaknesses: z.array(CoverLetterWeaknessSchema).min(1),
});
export type CoverLetterRefineRequest = z.infer<typeof CoverLetterRefineRequestSchema>;

export const CoverLetterChangeNoteSchema = z.object({
  heading: z.string().min(1),
  before: z.string().min(1),
  after: z.string().min(1),
  weaknessId: z.string().min(1),
});
export type CoverLetterChangeNote = z.infer<typeof CoverLetterChangeNoteSchema>;

export const CoverLetterRefineResultSchema = z.object({
  revised: CoverLetterResultSchema,
  appliedWeaknessIds: z.array(z.string()),
  changeNotes: z.array(CoverLetterChangeNoteSchema),
});
export type CoverLetterRefineResult = z.infer<typeof CoverLetterRefineResultSchema>;

// ─── Job (Phase 1: 공고 워크스페이스) ──────────────────

export const JobStatusSchema = z
  .enum(["explore", "applying", "interview", "done", "dropped"])
  .catch("explore");
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  explore: "탐색",
  applying: "지원중",
  interview: "면접",
  done: "완료",
  dropped: "포기",
};

export const JobMetaSchema = z.object({
  status: JobStatusSchema,
  notes: z.string().default(""),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedAt: z.number().default(0),
});
export type JobMeta = z.infer<typeof JobMetaSchema>;
