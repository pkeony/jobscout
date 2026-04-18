#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelId } from "@/lib/ai/types";
import { printReport, runEval } from "./runner";
import type { EvalTarget } from "./types";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value] = raw.slice(2).split("=");
    out[key] = value ?? "true";
  }
  return out;
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (process.env[key]) continue;
    process.env[key] = value;
  }
}

function assertEnv(keys: string[]): void {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`\n❌ 환경변수 누락: ${missing.join(", ")}`);
    console.error(`   .env.local 파일 또는 쉘 환경에 설정하세요.\n`);
    process.exit(1);
  }
}

const VALID_MODELS: ModelId[] = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const IMPLEMENTED_TARGETS: EvalTarget[] = [
  "match",
  "analyze",
  "cover-letter",
  "interview",
];

const GOLDSET_PATHS: Record<EvalTarget, string> = {
  match: "eval/goldset/matches.jsonl",
  analyze: "eval/goldset/analyses.jsonl",
  "cover-letter": "eval/goldset/cover-letters.jsonl",
  interview: "eval/goldset/interviews.jsonl",
};

async function main(): Promise<void> {
  loadEnvFile(join(process.cwd(), ".env.local"));
  loadEnvFile(join(process.cwd(), ".env"));

  const args = parseArgs(process.argv.slice(2));
  const target = (args.target ?? "match") as EvalTarget;
  const modelArg = (args.model ?? "gemini-2.5-flash") as ModelId;

  if (!VALID_MODELS.includes(modelArg)) {
    console.error(
      `❌ model은 다음 중 하나여야 합니다: ${VALID_MODELS.join(", ")}`,
    );
    process.exit(1);
  }

  if (!(target in GOLDSET_PATHS)) {
    console.error(
      `❌ 지원하지 않는 target: ${target}. 가능한 값: ${Object.keys(GOLDSET_PATHS).join(", ")}`,
    );
    process.exit(1);
  }

  if (!IMPLEMENTED_TARGETS.includes(target)) {
    console.error(
      `❌ --target=${target} 은 Phase E1 의 다음 단계에서 활성화 예정입니다. 지금 구현된 target: ${IMPLEMENTED_TARGETS.join(", ")}`,
    );
    process.exit(1);
  }

  assertEnv(["GOOGLE_API_KEY", "ANTHROPIC_API_KEY"]);

  const report = await runEval({
    target,
    goldsetPath: join(process.cwd(), GOLDSET_PATHS[target]),
    model: modelArg,
    outDir: join(process.cwd(), "eval/reports"),
  });
  printReport(report);
}

main().catch((err) => {
  console.error("\n💥 eval 실패:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
