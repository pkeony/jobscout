import type { AnalysisResult } from "@/types";
import type { AnalyzeExpected, AnalyzeRuleScore } from "../types";

/**
 * 도메인별 침입 탐지용 whitelist.
 * JD 가 해당 도메인을 명시적으로 포함하지 않을 때, output.skills 에 해당 도메인 스킬이
 * 나타나면 hallucination 으로 간주.
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  llm: [
    "llm",
    "gpt",
    "chatgpt",
    "claude",
    "gemini",
    "langchain",
    "langgraph",
    "rag",
    "vector db",
    "vectordb",
    "벡터디비",
    "벡터 db",
    "프롬프트 엔지니어링",
    "프롬프트엔지니어링",
    "에이전트 워크플로우",
    "에이전트워크플로우",
    "fine-tuning",
    "파인튜닝",
  ],
  cv: [
    "opencv",
    "yolo",
    "detectron",
    "cnn",
    "resnet",
    "imagenet",
    "이미지 분류",
    "이미지분류",
    "객체 탐지",
    "객체탐지",
    "영상 처리",
    "영상처리",
  ],
  "traditional-ml": [
    "scikit-learn",
    "sklearn",
    "xgboost",
    "lightgbm",
    "catboost",
    "피처 엔지니어링",
    "피처엔지니어링",
    "a/b 테스트",
    "ab 테스트",
  ],
  "data-eng": [
    "spark",
    "airflow",
    "dbt",
    "hadoop",
    "kafka",
    "etl",
    "데이터 파이프라인",
    "데이터파이프라인",
  ],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_\s]/g, "");
}

function matchesKeyword(skillName: string, keyword: string): boolean {
  return normalize(skillName).includes(normalize(keyword));
}

function countHits(
  names: readonly string[],
  skills: readonly { name: string }[],
): number {
  return names.filter((needle) =>
    skills.some((s) => matchesKeyword(s.name, needle)),
  ).length;
}

export function evaluateAnalyzeRules(
  result: AnalysisResult,
  expected: AnalyzeExpected,
  jdText: string,
): Omit<AnalyzeRuleScore, "schemaValidity"> {
  const skillsInRange =
    result.skills.length >= 1 && result.skills.length <= expected.maxSkills;

  const validCategories = new Set(["required", "preferred", "etc"]);
  const categoryEnumValid = result.skills.every((s) =>
    validCategories.has(s.category),
  );

  const mustHaveHits = countHits(expected.mustHaveSkills, result.skills);
  const mustHaveTotal = expected.mustHaveSkills.length;
  const preferredSkills = result.skills.filter(
    (s) => s.category === "preferred",
  );
  const mustHavePreferredHits = countHits(
    expected.mustHavePreferredSkills,
    preferredSkills.length > 0 ? preferredSkills : result.skills,
  );
  const mustHavePreferredTotal = expected.mustHavePreferredSkills.length;

  // JD 원문에 회사명이 등장하지 않는 케이스(이미지 OCR 등) 는 companyInfo 누락 허용
  const hasCompanyName = Boolean(result.companyInfo?.name?.trim());
  const jdHintsCompany = /주식회사|㈜|\(주\)|Inc\.|Ltd\.|Co\./.test(jdText);
  const companyInfoPresent = !jdHintsCompany || hasCompanyName;

  const domainIntrusionCount = expected.forbiddenDomains.reduce(
    (total, domain) => {
      const keywords = DOMAIN_KEYWORDS[domain] ?? [];
      const hits = result.skills.filter((s) =>
        keywords.some((kw) => matchesKeyword(s.name, kw)),
      );
      return total + hits.length;
    },
    0,
  );

  return {
    skillsInRange,
    categoryEnumValid,
    mustHaveHits,
    mustHaveTotal,
    mustHavePreferredHits,
    mustHavePreferredTotal,
    companyInfoPresent,
    domainIntrusionCount,
  };
}

export function summarizeAnalyzeRules(rules: AnalyzeRuleScore): string {
  const parts = [
    `schema=${rules.schemaValidity ? "✓" : "✗"}`,
    `skills=${rules.skillsInRange ? "✓" : "✗"}`,
    `cat=${rules.categoryEnumValid ? "✓" : "✗"}`,
    `mustHave=${rules.mustHaveHits}/${rules.mustHaveTotal}`,
    `preferred=${rules.mustHavePreferredHits}/${rules.mustHavePreferredTotal}`,
    `company=${rules.companyInfoPresent ? "✓" : "✗"}`,
    `intrusion=${rules.domainIntrusionCount}`,
  ];
  return parts.join(" ");
}
