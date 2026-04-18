import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelId } from "@/lib/ai/types";
import {
  printAnalyzeReport,
  runAnalyzeEval,
  type RunAnalyzeEvalOpts,
} from "./runners/analyze";
import {
  printMatchReport,
  runMatchEval,
  type RunMatchEvalOpts,
} from "./runners/match";
import type { EvalReport, EvalTarget } from "./types";

export interface RunEvalOpts {
  target: EvalTarget;
  goldsetPath: string;
  model: ModelId;
  outDir: string;
}

export async function runEval(opts: RunEvalOpts): Promise<EvalReport> {
  const subOpts: RunMatchEvalOpts | RunAnalyzeEvalOpts = {
    goldsetPath: opts.goldsetPath,
    model: opts.model,
  };
  let report: EvalReport;
  switch (opts.target) {
    case "match":
      report = await runMatchEval(subOpts);
      break;
    case "analyze":
      report = await runAnalyzeEval(subOpts);
      break;
    case "cover-letter":
    case "interview":
      throw new Error(
        `[runner] target=${opts.target} 아직 구현되지 않았습니다.`,
      );
    default: {
      const _exhaustive: never = opts.target;
      throw new Error(`[runner] 알 수 없는 target: ${String(_exhaustive)}`);
    }
  }

  await persistReport(opts.outDir, report);
  return report;
}

async function persistReport(
  outDir: string,
  report: EvalReport,
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const filename = `${report.runId}-${report.target}-${report.model}.json`;
  const path = join(outDir, filename);
  await writeFile(path, JSON.stringify(report, null, 2), "utf8");
  console.log(`[eval] 리포트 저장: ${path}`);
}

export function printReport(report: EvalReport): void {
  switch (report.target) {
    case "match":
      printMatchReport(report);
      return;
    case "analyze":
      printAnalyzeReport(report);
      return;
    default: {
      const _exhaustive: never = report;
      throw new Error(`[runner] 알 수 없는 target: ${String(_exhaustive)}`);
    }
  }
}
