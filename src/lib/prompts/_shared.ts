import type { AnalysisResult, UserProfile } from "@/types";

export function buildFocusBlock(focusPosition?: string): string {
  if (!focusPosition?.trim()) return "";
  return `
## 사용자가 집중 분석을 요청한 포지션
"${focusPosition.trim()}"
이 포지션에 한정해서 답하세요. JD에 다른 포지션이 섞여 있더라도 위 포지션 관련 정보만 사용.
`;
}

export function buildStructuredJdBlock(a?: AnalysisResult): string {
  if (!a) return "";

  const requirements = a.requirements.length > 0
    ? a.requirements.map((r) => `- ${r}`).join("\n")
    : "- (명시 없음)";
  const preferred = a.preferredRequirements.length > 0
    ? a.preferredRequirements.map((r) => `- ${r}`).join("\n")
    : "- (명시 없음)";
  const responsibilities = a.keyResponsibilities.length > 0
    ? a.keyResponsibilities.map((r) => `- ${r}`).join("\n")
    : "- (명시 없음)";
  const skills = a.skills.length > 0
    ? a.skills
        .map((s) => `- ${s.name} [${s.category}, ${s.level}]${s.context ? ` — ${s.context}` : ""}`)
        .join("\n")
    : "- (명시 없음)";

  const industryFragment = a.companyInfo.industry ? ` · ${a.companyInfo.industry}` : "";

  return `
## JD 분석 결과 (primary source)
**직무**: ${a.roleTitle}
**경력 요건**: ${a.experienceLevel}
**회사**: ${a.companyInfo.name}${industryFragment}

### 자격 요건 (필수)
${requirements}

### 우대 요건
${preferred}

### 주요 업무
${responsibilities}

### 요구 스킬 (category · level)
${skills}
`;
}

export function buildRawJdSection(jdText: string, hasStructured: boolean): string {
  if (hasStructured) {
    const preview = jdText.slice(0, 300);
    const ellipsis = jdText.length > 300 ? "..." : "";
    return `\n## JD 원문 미리보기\n${preview}${ellipsis}`;
  }
  return `\n## 채용공고\n${jdText}`;
}

export function serializeProfile(p: UserProfile): string {
  return [
    `보유 스킬: ${p.skills.join(", ")}`,
    `경력: ${p.experience}`,
    p.education ? `학력: ${p.education}` : null,
    p.introduction ? `자기소개: ${p.introduction}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
