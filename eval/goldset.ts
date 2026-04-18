import { readFile } from "node:fs/promises";
import { GoldsetCaseSchema, type GoldsetCase } from "./types";

/**
 * JSONL (한 줄 = 한 case) 파일을 로드해 유효성 검사.
 * 빈 줄/주석(#로 시작)은 무시.
 */
export async function loadGoldset(path: string): Promise<GoldsetCase[]> {
  const text = await readFile(path, "utf8");
  const lines = text.split("\n");
  const cases: GoldsetCase[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      cases.push(GoldsetCaseSchema.parse(parsed));
    } catch (err) {
      throw new Error(
        `[goldset] line ${i + 1} 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return cases;
}
