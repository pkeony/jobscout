export const JOB_TAB_VALUES = [
  "analyze",
  "match",
  "cover-letter",
  "interview",
  "notes",
] as const;

export type JobTabValue = (typeof JOB_TAB_VALUES)[number];

export const JOB_TAB_LABELS: Record<JobTabValue, string> = {
  analyze: "분석",
  match: "매칭",
  "cover-letter": "자소서",
  interview: "면접",
  notes: "메모",
};

export function isJobTabValue(v: string): v is JobTabValue {
  return (JOB_TAB_VALUES as readonly string[]).includes(v);
}
