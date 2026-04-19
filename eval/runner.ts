import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelId } from "@/lib/ai/types";
import {
  printAnalyzeReport,
  runAnalyzeEval,
  type RunAnalyzeEvalOpts,
} from "./runners/analyze";
import {
  printCoverLetterReport,
  runCoverLetterEval,
  type RunCoverLetterEvalOpts,
} from "./runners/cover-letter";
import {
  printCoverLetterTraceReport,
  runCoverLetterTraceEval,
  type RunCoverLetterTraceEvalOpts,
} from "./runners/cover-letter-trace";
import {
  printInterviewReport,
  runInterviewEval,
  type RunInterviewEvalOpts,
} from "./runners/interview";
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
  const subOpts:
    | RunMatchEvalOpts
    | RunAnalyzeEvalOpts
    | RunCoverLetterEvalOpts
    | RunCoverLetterTraceEvalOpts
    | RunInterviewEvalOpts = {
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
      report = await runCoverLetterEval(subOpts);
      break;
    case "cover-letter-trace":
      report = await runCoverLetterTraceEval(subOpts);
      break;
    case "interview":
      report = await runInterviewEval(subOpts);
      break;
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
    case "cover-letter":
      printCoverLetterReport(report);
      return;
    case "cover-letter-trace":
      printCoverLetterTraceReport(report);
      return;
    case "interview":
      printInterviewReport(report);
      return;
    default: {
      const _exhaustive: never = report;
      throw new Error(`[runner] 알 수 없는 target: ${String(_exhaustive)}`);
    }
  }
}
