import fs from "node:fs/promises";
import path from "node:path";
import type { RecipeListItem } from "../types/index.js";

export async function loadUsageStatsFile(
  filePath: string,
): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        out[k] = Math.floor(v);
      }
    }
    return out;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return {};
    }
    console.error(`[recipe-deck] recipe usage file unreadable ${filePath}:`, err.message);
    return {};
  }
}

export async function saveUsageStatsFile(
  filePath: string,
  counts: Record<string, number>,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const body = `${JSON.stringify(counts, null, 0)}\n`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, filePath);
}

/** Broken recipes last; then descending by run count; then stem. Adds `runCount` on each item. */
export function sortRecipesByUsage(
  items: RecipeListItem[],
  counts: Record<string, number>,
): RecipeListItem[] {
  return [...items]
    .map((r) => ({
      ...r,
      runCount: counts[r.stem] ?? 0,
    }))
    .sort((a, b) => {
      const aBr = a.broken ? 1 : 0;
      const bBr = b.broken ? 1 : 0;
      if (aBr !== bBr) {
        return aBr - bBr;
      }
      const ca = a.runCount ?? 0;
      const cb = b.runCount ?? 0;
      if (cb !== ca) {
        return cb - ca;
      }
      return a.stem.localeCompare(b.stem);
    });
}
