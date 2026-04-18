#!/usr/bin/env tsx
/**
 * 기존 goldset 의 jdText + focusPosition 을 유지한 채 analysisResult 만 새 analyze
 * 프롬프트로 갱신. analyze 프롬프트 변경 후 match eval 에 반영하려면 이 스크립트를
 * 한 번 돌린다. crawling 은 스킵(기존 jdText 보존).
 *
 * 사용: dev 서버(pnpm dev)가 돌고 있어야 함.
 *   pnpm tsx eval/regenerate-analysis.ts
 *
 * 실패한 case 는 기존 analysisResult 유지 (전체 롤백 방지).
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AnalysisResultSchema } from "@/types";
import type { GoldsetCase } from "./types";

const DEV_SERVER = process.env.DEV_SERVER ?? "http://localhost:3000";

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

async function main(): Promise<void> {
  const path = join(process.cwd(), "eval/goldset/matches.jsonl");
  const raw = await readFile(path, "utf8");
  const cases: GoldsetCase[] = raw
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as GoldsetCase);

  process.stderr.write(`[regen] ${cases.length}개 case 재분석 시작 (dev 서버: ${DEV_SERVER})\n\n`);

  const updated: GoldsetCase[] = [];
  let okCount = 0;
  let failCount = 0;
  for (const c of cases) {
    process.stderr.write(
      `[${c.id}] analyzing jdLen=${c.jdText.length} focus=${c.focusPosition ?? "-"}\n`,
    );
    try {
      const result = AnalysisResultSchema.parse(await analyze(c.jdText, c.focusPosition));
      updated.push({ ...c, analysisResult: result });
      okCount++;
      process.stderr.write(
        `  ✓ skills=${result.skills.length} requirements=${result.requirements.length}\n`,
      );
    } catch (err) {
      failCount++;
      const msg = err instanceof Error ? err.message.slice(0, 150) : String(err);
      process.stderr.write(`  ✗ 실패 (기존 유지): ${msg}\n`);
      updated.push(c);
    }
  }

  const jsonl = updated.map((c) => JSON.stringify(c)).join("\n") + "\n";
  await writeFile(path, jsonl, "utf8");
  process.stderr.write(`\n✓ goldset 갱신 완료: ${path}\n`);
  process.stderr.write(`  성공 ${okCount} / 실패 ${failCount} (실패는 기존 analysisResult 유지)\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
