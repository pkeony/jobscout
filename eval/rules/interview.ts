import type { InterviewQuestion, UserProfile } from "@/types";
import type { InterviewExpected, InterviewRuleScore } from "../types";

export interface InterviewRuleInput {
  questions: InterviewQuestion[];
  tips: string[];
  /**
   * pre-normalize 의 원본 카테고리 분포. normalize 가 초과분을 잘라내기 전에
   * 기록해야 "원래 몇 개 나왔는지" 신호가 살아남는다.
   */
  rawCounts: {
    technical: number;
    behavioral: number;
    situational: number;
    other: number;
  };
  rawTipsCount: number;
  profile: UserProfile | null;
}

function sentenceCount(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  // 한글 문장 구분자까지 포함. 너무 짧은(1~2자) 세그먼트는 문장으로 안 침.
  const parts = cleaned
    .split(/[.!?。…]+/u)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
  return parts.length;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_\s]/g, "");
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter((w) => w.length >= 2));
  const tokensB = new Set(b.split(/\s+/).filter((w) => w.length >= 2));
  if (tokensA.size === 0 && tokensB.size === 0) return 0;
  const intersect = [...tokensA].filter((w) => tokensB.has(w)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersect / union;
}

export function evaluateInterviewRules(
  input: InterviewRuleInput,
  expected: InterviewExpected,
): Omit<InterviewRuleScore, "schemaValidity"> {
  const { questions, tips, rawCounts, rawTipsCount, profile } = input;

  const categoryDistributionExact =
    rawCounts.technical === expected.technicalCount &&
    rawCounts.behavioral === expected.behavioralCount &&
    rawCounts.situational === expected.situationalCount &&
    rawCounts.other === 0;

  // 순서 체크: technical → behavioral → situational 이어야.
  let categoryOrderValid = true;
  const orderIdx: Record<InterviewQuestion["category"], number> = {
    technical: 0,
    behavioral: 1,
    situational: 2,
  };
  let lastIdx = -1;
  for (const q of questions) {
    const idx = orderIdx[q.category];
    if (idx < lastIdx) {
      categoryOrderValid = false;
      break;
    }
    lastIdx = idx;
  }

  const sentenceCounts = questions.map((q) => sentenceCount(q.sampleAnswer));
  const avgSampleAnswerSentences =
    sentenceCounts.length > 0
      ? sentenceCounts.reduce((s, v) => s + v, 0) / sentenceCounts.length
      : 0;
  const sampleAnswerSentenceValid = sentenceCounts.every(
    (c) =>
      c >= expected.minSampleAnswerSentences &&
      c <= expected.maxSampleAnswerSentences,
  );
  const sampleAnswerAvgValid =
    avgSampleAnswerSentences >= expected.minSampleAnswerSentences &&
    avgSampleAnswerSentences <= expected.maxSampleAnswerSentences;

  let profileSkillMentionCount = 0;
  let profileSkillTotal = 0;
  if (profile && profile.skills.length > 0) {
    profileSkillTotal = profile.skills.length;
    const haystack = questions
      .filter((q) => q.category === "technical")
      .flatMap((q) => [q.question, q.intent, q.sampleAnswer])
      .map(normalize)
      .join(" ");
    profileSkillMentionCount = profile.skills.filter((skill) =>
      haystack.includes(normalize(skill)),
    ).length;
  }

  let duplicateQuestionPairs = 0;
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      if (
        jaccardSimilarity(questions[i].question, questions[j].question) >= 0.8
      ) {
        duplicateQuestionPairs++;
      }
    }
  }

  return {
    preTechnicalCount: rawCounts.technical,
    preBehavioralCount: rawCounts.behavioral,
    preSituationalCount: rawCounts.situational,
    preTipsCount: rawTipsCount,
    categoryDistributionExact,
    categoryOrderValid,
    avgSampleAnswerSentences,
    sampleAnswerSentenceValid,
    sampleAnswerAvgValid,
    profileSkillMentionCount,
    profileSkillTotal,
    duplicateQuestionPairs,
  };
}

export function summarizeInterviewRules(rules: InterviewRuleScore): string {
  return [
    `schema=${rules.schemaValidity ? "✓" : "✗"}`,
    `dist=${rules.preTechnicalCount}/${rules.preBehavioralCount}/${rules.preSituationalCount}`,
    `tips=${rules.preTipsCount}`,
    `order=${rules.categoryOrderValid ? "✓" : "✗"}`,
    `sent=avg${rules.sampleAnswerAvgValid ? "✓" : "✗"}(${rules.avgSampleAnswerSentences.toFixed(1)})/all${rules.sampleAnswerSentenceValid ? "✓" : "✗"}`,
    `profile=${rules.profileSkillMentionCount}/${rules.profileSkillTotal}`,
    `dup=${rules.duplicateQuestionPairs}`,
  ].join(" ");
}
