import fs from "node:fs/promises";
import path from "node:path";

/**
 * Resolve `mods/<mod>` under spark root (same as run-recipe.py `SCRIPT_DIR / "mods" / mod`).
 * Rejects paths that escape `mods/` (.., absolute).
 */
export function resolveSparkModPath(sparkRoot: string, mod: string): string | null {
  const t = mod.trim();
  if (!t) {
    return null;
  }
  const modsRoot = path.resolve(sparkRoot, "mods");
  const resolved = path.resolve(modsRoot, t);
  const rel = path.relative(modsRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return resolved;
}

/** For each entry (in order), true if blank line, else whether the path exists on disk. */
export async function modsExistenceResults(
  sparkRoot: string,
  mods: string[],
): Promise<boolean[]> {
  const out: boolean[] = [];
  for (const raw of mods) {
    const t = raw.trim();
    if (!t) {
      out.push(true);
      continue;
    }
    const abs = resolveSparkModPath(sparkRoot, t);
    if (!abs) {
      out.push(false);
      continue;
    }
    try {
      await fs.access(abs);
      out.push(true);
    } catch {
      out.push(false);
    }
  }
  return out;
}
