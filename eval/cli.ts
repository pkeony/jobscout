#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelId } from "@/lib/ai/types";
import { printReport, runEval } from "./runner";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value] = raw.slice(2).split("=");
    out[key] = value ?? "true";
  }
  return out;
}

/**
 * .env.local을 파싱해서 process.env로 흘려 넣는다.
 * dotenv 의존 없이 경량 구현.
 */
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

async function main(): Promise<void> {
  loadEnvFile(join(process.cwd(), ".env.local"));
  loadEnvFile(join(process.cwd(), ".env"));

  const args = parseArgs(process.argv.slice(2));
  const target = args.target ?? "match";
  const modelArg = (args.model ?? "gemini-2.5-flash") as ModelId;

  if (!VALID_MODELS.includes(modelArg)) {
    console.error(
      `❌ model은 다음 중 하나여야 합니다: ${VALID_MODELS.join(", ")}`,
    );
    process.exit(1);
  }

  if (target === "cover-letter" || target === "interview" || target === "analyze") {
    console.error(
      `❌ --target=${target} 은 Phase E1 에서 활성화 예정입니다. 지금은 match 만 가능.`,
    );
    process.exit(1);
  }

  if (target !== "match") {
    console.error(
      `❌ 지원하지 않는 target: ${target}. 가능한 값: match (E1 이후 cover-letter / interview / analyze 추가).`,
    );
    process.exit(1);
  }

  assertEnv(["GOOGLE_API_KEY", "ANTHROPIC_API_KEY"]);

  const report = await runEval({
    goldsetPath: join(process.cwd(), "eval/goldset/matches.jsonl"),
    model: modelArg,
    outDir: join(process.cwd(), "eval/reports"),
  });
  printReport(report);
}

main().catch((err) => {
  console.error("\n💥 eval 실패:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
