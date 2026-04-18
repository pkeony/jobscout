import { readFile } from "node:fs/promises";
import { z } from "zod";
import { GoldsetCaseSchema, type GoldsetCase } from "./types";

/**
 * JSONL (한 줄 = 한 case) 파일을 로드해 유효성 검사.
 * 빈 줄/주석(#로 시작)은 무시.
 *
 * schema 를 지정하면 target 별 엄격 검증. 미지정 시 union 으로 모두 허용.
 */
export async function loadGoldset<S extends z.ZodType = typeof GoldsetCaseSchema>(
  path: string,
  schema?: S,
): Promise<S extends z.ZodType<infer T> ? T[] : GoldsetCase[]> {
  const effective = (schema ?? GoldsetCaseSchema) as z.ZodType;
  const text = await readFile(path, "utf8");
  const lines = text.split("\n");
  const cases: unknown[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      cases.push(effective.parse(parsed));
    } catch (err) {
      throw new Error(
        `[goldset] ${path} line ${i + 1} 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return cases as S extends z.ZodType<infer T> ? T[] : GoldsetCase[];
}
