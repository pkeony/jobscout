#!/usr/bin/env tsx
/**
 * 골든셋 초안 수집 스크립트.
 * 각 source의 URL을 /api/crawl + /api/analyze 로 돌려서 실제 jdText와 analysisResult를 뽑고
 * 사용자가 설계한 profile/focusPosition/expected와 조합해 matches.jsonl로 출력한다.
 *
 * 사용: dev 서버(pnpm dev)가 돌고 있어야 함.
 *   pnpm tsx eval/collect-goldset.ts > eval/goldset/matches.jsonl.draft
 *
 * 출력 후 사용자가 expected 값을 검수·수정해서 matches.jsonl로 옮기는 흐름.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AnalysisResultSchema, type UserProfile } from "@/types";
import type { MatchExpected, MatchGoldsetCase } from "./types";

const DEV_SERVER = process.env.DEV_SERVER ?? "http://localhost:3000";

interface Source {
  id: string;
  label: string;
  url: string;
  focusPosition?: string;
  profile: UserProfile;
  expected: MatchExpected;
}

/**
 * 수집 대상 10개 — JD는 자동 수집, profile/expected는 설계자(여기서는 AI가 draft).
 * 사용자가 검수 시 scoreRange/mustMatch/judgeRubric 위주로 수정.
 */
const SOURCES: Source[] = [
  {
    id: "case-01",
    label: "원티드 AI Engineer × LLM 경력 3년",
    url: "https://www.wanted.co.kr/wd/324408",
    profile: {
      skills: ["Python", "LLM", "LangChain", "RAG", "FastAPI"],
      experience: "AI 엔지니어 3년 — B2B 챗봇 LLM 파이프라인 구축, RAG 운영",
      education: "컴퓨터공학 학사",
      introduction: "LLM 프로덕션 운영 경험 풍부",
    },
    expected: {
      scoreRange: [70, 95],
      mustMatch: ["Python", "LLM"],
      mustNotGap: ["Python"],
      judgeRubric: "Python·LLM 보유 + 3년 경력으로 AI Engineer 매칭도 높음. match 위주 예상.",
    },
  },
  {
    id: "case-02",
    label: "원티드 AI Engineer × Java 백엔드 (mismatch)",
    url: "https://www.wanted.co.kr/wd/324408",
    profile: {
      skills: ["Java", "Spring", "MySQL", "Kafka"],
      experience: "백엔드 엔지니어 4년 — MSA 시스템, 결제 도메인",
      education: "정보통신 학사",
    },
    expected: {
      scoreRange: [15, 45],
      mustMatch: [],
      mustNotGap: [],
      judgeRubric: "Java 백엔드 경력자가 AI Engineer 지원 — 대부분 gap 예상. 점수는 기본점수+일부 우대 정도.",
    },
  },
  {
    id: "case-03",
    label: "원티드 AI Engineer × Python 튜토리얼 수준",
    url: "https://www.wanted.co.kr/wd/324408",
    profile: {
      skills: ["Python"],
      experience: "컴퓨터공학과 졸업 예정, 개인 프로젝트 2~3개 (Flask 튜토리얼, 간단한 LLM API 호출 스크립트)",
      education: "컴퓨터공학 학사 (졸업 예정)",
    },
    expected: {
      scoreRange: [30, 60],
      mustMatch: [],
      mustNotGap: [],
      judgeRubric: "Python 있지만 실무 수준 부족. skills[].level에 따라 partial이 주를 이뤄야. advanced 요구 스킬은 gap.",
    },
  },
  {
    id: "case-04",
    label: "잡코리아 헤이딜러 × Field PM 경력 (focus 적용)",
    url: "https://www.jobkorea.co.kr/Recruit/GI_Read/48912289",
    focusPosition: "POP팀 - 테크베이 Field PM",
    profile: {
      skills: ["프로젝트 관리", "현장 운영", "팀 리딩", "Excel", "SQL"],
      experience: "현장 PM 5년 — 전국 오프라인 매장 3개 동시 운영, 인력 40명 관리",
      education: "경영학 학사",
    },
    expected: {
      scoreRange: [55, 80],
      mustMatch: [],
      mustNotGap: [],
      judgeRubric: "focusPosition이 Field PM이라 그 포지션 요건만 평가해야. 다른 파트(정비·디테일링)는 skillMatches에 포함되면 안 됨.",
    },
  },
  {
    id: "case-05",
    label: "잡인크루트 국방연구원 × 연구원 시니어",
    url: "https://job.incruit.com/jobdb_info/jobpost.asp?job=2604140002140",
    profile: {
      skills: ["정책 분석", "보고서 작성", "데이터 분석", "SPSS"],
      experience: "정부출연 연구기관 연구원 6년 — 국방 정책 분석 보고서 30건+",
      education: "국방경영 석사",
    },
    expected: {
      scoreRange: [55, 85],
      mustMatch: [],
      mustNotGap: [],
      judgeRubric: "이미지 OCR 경유해 들어온 공고. 정책 연구자 매칭도 판정 정확해야.",
    },
  },
  {
    id: "case-06",
    label: "점프핏 캐롯아이 백엔드 × 풀스택 경력",
    url: "https://jumpit.saramin.co.kr/position/53433340",
    profile: {
      skills: ["Java", "Spring", "AWS", "MySQL", "React", "TypeScript", "Git"],
      experience: "풀스택 2년 — Spring Boot + React SPA 개발, AWS ECS 배포",
      education: "컴퓨터공학 학사",
    },
    expected: {
      scoreRange: [65, 90],
      mustMatch: ["AWS", "Git"],
      mustNotGap: ["AWS", "Git"],
      judgeRubric: "백엔드 포지션에 풀스택 지원 — 백엔드 스킬(Java/Spring/AWS)은 match, 우대(JPA, Kotlin) 일부 partial.",
    },
  },
  {
    id: "case-07",
    label: "점프핏 캐롯아이 백엔드 × 프론트엔드 전용",
    url: "https://jumpit.saramin.co.kr/position/53433340",
    profile: {
      skills: ["React", "TypeScript", "Next.js", "Tailwind"],
      experience: "프론트엔드 3년 — 대시보드 SPA 위주 개발",
      education: "디자인학 학사",
    },
    expected: {
      scoreRange: [15, 40],
      mustMatch: [],
      mustNotGap: [],
      judgeRubric: "백엔드 포지션에 프론트엔드 지원 — 대부분 gap. 낮은 점수 + 솔직한 조언 나와야.",
    },
  },
  {
    id: "case-08",
    label: "피플앤잡 HR 컨설팅 LLM × LLM 엔지니어",
    url: "https://www.peoplenjob.com/jobs/6184511?type=work&work_code_id=124",
    profile: {
      skills: ["Python", "LangGraph", "RAG", "LLM", "NLP", "FastAPI", "PostgreSQL"],
      experience: "LLM 엔지니어 2년 — B2B 구매 도메인 에이전트 개발, LangGraph state machine 구현",
      education: "데이터사이언스 석사",
    },
    expected: {
      scoreRange: [75, 98],
      mustMatch: ["LangGraph", "RAG", "LLM"],
      mustNotGap: ["LangGraph", "RAG"],
      judgeRubric: "공고 요구 스킬과 프로필이 거의 1:1. 가장 높은 점수대 기대. 모든 필수 스킬 match여야.",
    },
  },
  {
    id: "case-09",
    label: "피플앤잡 HR 컨설팅 LLM × 전통 백엔드 시니어",
    url: "https://www.peoplenjob.com/jobs/6184511?type=work&work_code_id=124",
    profile: {
      skills: ["Java", "Spring Boot", "PostgreSQL", "Docker", "Kubernetes", "Kafka"],
      experience: "백엔드 시니어 5년 — 대규모 분산 시스템 설계",
      education: "컴퓨터공학 학사",
    },
    expected: {
      scoreRange: [35, 65],
      mustMatch: [],
      mustNotGap: [],
      judgeRubric: "LLM 특화 공고에 전통 BE 지원 — LLM/RAG/LangGraph는 gap. 하지만 백엔드 인프라(DB/Docker/K8s)는 partial일 수 있음.",
    },
  },
  {
    id: "case-10",
    label: "원티드 AI Engineer × ML 연구자 (LLM 미경험)",
    url: "https://www.wanted.co.kr/wd/324408",
    profile: {
      skills: ["Python", "PyTorch", "TensorFlow", "CNN", "Computer Vision"],
      experience: "ML 연구 2년 — 이미지 분류 모델 논문 2편, CNN/ViT 위주",
      education: "AI 석사",
    },
    expected: {
      scoreRange: [45, 75],
      mustMatch: ["Python"],
      mustNotGap: [],
      judgeRubric: "Python과 ML 기초는 있지만 LLM/멀티모달 직접 경험 부족. partial 위주, 학습 가능성 높음 → 조언이 건설적이어야.",
    },
  },
];

interface CrawlResponse {
  title: string;
  company: string;
  text: string;
  url: string;
  positions?: string[];
}

async function crawl(url: string): Promise<CrawlResponse> {
  const res = await fetch(`${DEV_SERVER}/api/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`crawl 실패 ${res.status}: ${body}`);
  }
  return (await res.json()) as CrawlResponse;
}

/**
 * /api/analyze는 SSE를 반환. 본 스크립트는 delta를 누적하고 extractJson으로 파싱.
 * extractJson은 src/lib/prompts/analyze.ts에 정의되어 있어 그대로 재사용.
 */
async function analyze(text: string, focusPosition?: string): Promise<unknown> {
  const res = await fetch(`${DEV_SERVER}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, focusPosition }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`analyze 실패 ${res.status}: ${body}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("analyze 스트림 없음");
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 파싱: \n\n 단위로 이벤트 분리, data: 라인에서 JSON 추출
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const block of events) {
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          const payload: unknown = JSON.parse(line.slice(5).trim());
          if (
            payload &&
            typeof payload === "object" &&
            "type" in payload &&
            (payload as { type: string }).type === "delta" &&
            "text" in payload
          ) {
            full += (payload as { text: string }).text;
          }
        } catch {
          // ignore
        }
      }
    }
  }
  // full은 AnalysisResult JSON일 가능성 높음 (코드블록 래핑 제거)
  const { extractJson } = await import("@/lib/prompts/analyze");
  return extractJson(full);
}

async function main(): Promise<void> {
  const caseList: MatchGoldsetCase[] = [];
  for (const src of SOURCES) {
    process.stderr.write(`[${src.id}] crawling ${src.url}\n`);
    const crawled = await crawl(src.url);
    process.stderr.write(`  title="${crawled.title.slice(0, 40)}" text=${crawled.text.length}자\n`);

    process.stderr.write(`[${src.id}] analyzing${src.focusPosition ? ` (focus=${src.focusPosition})` : ""}\n`);
    const raw = await analyze(crawled.text, src.focusPosition);
    const analysisResult = AnalysisResultSchema.parse(raw);
    process.stderr.write(`  skills=${analysisResult.skills.length} requirements=${analysisResult.requirements.length}\n`);

    caseList.push({
      id: src.id,
      label: src.label,
      target: "match",
      jdText: crawled.text,
      analysisResult,
      profile: src.profile,
      focusPosition: src.focusPosition,
      expected: src.expected,
    });
  }

  const outPath = join(process.cwd(), "eval/goldset/matches.jsonl");
  const jsonl = caseList.map((c) => JSON.stringify(c)).join("\n") + "\n";
  await writeFile(outPath, jsonl, "utf8");
  process.stderr.write(`\n✓ ${caseList.length}개 case 저장: ${outPath}\n`);
  process.stderr.write(`  사용자 검수 항목: expected.scoreRange, mustMatch, mustNotGap, judgeRubric\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
