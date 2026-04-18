#!/usr/bin/env tsx
/**
 * 기존 goldset 의 jdText/focusPosition 을 유지한 채 analysisResult 만 새 analyze
 * 프롬프트로 갱신. 4종 goldset (matches / analyses / cover-letters / interviews)
 * 중 선택(기본 all) 으로 동기화.
 *
 * 사용: dev 서버(pnpm dev)가 돌고 있어야 함.
 *   pnpm tsx eval/regenerate-analysis.ts [--target=all|match|analyze|cover-letter|interview]
 *
 * 실패한 case 는 기존 analysisResult 유지 (전체 롤백 방지).
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AnalysisResultSchema } from "@/types";

const DEV_SERVER = process.env.DEV_SERVER ?? "http://localhost:3000";

type Target = "match" | "analyze" | "cover-letter" | "interview";
const ALL_TARGETS: Target[] = ["match", "analyze", "cover-letter", "interview"];

const PATH_BY_TARGET: Record<Target, string> = {
  match: "eval/goldset/matches.jsonl",
  analyze: "eval/goldset/analyses.jsonl",
  "cover-letter": "eval/goldset/cover-letters.jsonl",
  interview: "eval/goldset/interviews.jsonl",
};

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value] = raw.slice(2).split("=");
    out[key] = value ?? "true";
  }
  return out;
}

async function analyze(text: string, focusPosition?: string): Promise<unknown> {
  const res = await fetch(`${DEV_SERVER}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, focusPosition }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`analyze ${res.status}: ${body.slice(0, 200)}`);
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
  const { extractJson } = await import("@/lib/prompts/analyze");
  return extractJson(full);
}

interface MinimalCase {
  id?: unknown;
  jdText?: unknown;
  focusPosition?: unknown;
  analysisResult?: unknown;
  [key: string]: unknown;
}

async function regenerateFile(path: string): Promise<{ ok: number; fail: number }> {
  const raw = await readFile(path, "utf8");
  const lines = raw.trim().split("\n");
  const cases: MinimalCase[] = lines.map((l) => JSON.parse(l) as MinimalCase);

  process.stderr.write(`\n=== ${path} · ${cases.length}개 case ===\n`);

  let ok = 0;
  let fail = 0;
  const updated: MinimalCase[] = [];
  for (const c of cases) {
    const id = typeof c.id === "string" ? c.id : "?";
    const jdText = typeof c.jdText === "string" ? c.jdText : "";
    const focus =
      typeof c.focusPosition === "string" ? c.focusPosition : undefined;
    process.stderr.write(
      `  [${id}] analyzing jdLen=${jdText.length} focus=${focus ?? "-"}\n`,
    );
    try {
      const result = AnalysisResultSchema.parse(await analyze(jdText, focus));
      updated.push({ ...c, analysisResult: result });
      ok++;
      process.stderr.write(
        `    ✓ skills=${result.skills.length} requirements=${result.requirements.length}\n`,
      );
    } catch (err) {
      fail++;
      const msg = err instanceof Error ? err.message.slice(0, 150) : String(err);
      process.stderr.write(`    ✗ 실패 (기존 유지): ${msg}\n`);
      updated.push(c);
    }
  }

  const jsonl = updated.map((c) => JSON.stringify(c)).join("\n") + "\n";
  await writeFile(path, jsonl, "utf8");
  process.stderr.write(`  → saved (성공 ${ok} / 실패 ${fail})\n`);
  return { ok, fail };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rawTarget = (args.target ?? "all") as Target | "all";

  let targets: Target[];
  if (rawTarget === "all") {
    targets = ALL_TARGETS;
  } else if (ALL_TARGETS.includes(rawTarget as Target)) {
    targets = [rawTarget as Target];
  } else {
    console.error(
      `❌ target 은 다음 중 하나여야 합니다: all, ${ALL_TARGETS.join(", ")}`,
    );
    process.exit(1);
  }

  process.stderr.write(
    `[regen] target=${targets.join(",")} dev 서버=${DEV_SERVER}\n`,
  );

  let totalOk = 0;
  let totalFail = 0;
  for (const t of targets) {
    const path = join(process.cwd(), PATH_BY_TARGET[t]);
    try {
      const { ok, fail } = await regenerateFile(path);
      totalOk += ok;
      totalFail += fail;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n✗ ${path} 전체 실패: ${msg}\n`);
      totalFail += 1;
    }
  }

  process.stderr.write(
    `\n✓ regen 완료: ok ${totalOk} / fail ${totalFail} (실패는 기존 analysisResult 유지)\n`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
