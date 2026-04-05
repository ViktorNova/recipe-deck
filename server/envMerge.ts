import fs from "node:fs/promises";

/** Match `HF_TOKEN=...` or `export HF_TOKEN=...` (optional leading whitespace). */
function isHfTokenAssignmentLine(line: string): boolean {
  return /^\s*(?:export\s+)?HF_TOKEN=/.test(line);
}

/**
 * Write token as a single .env line. Quote if the value has shell-special chars.
 */
function formatHfTokenLine(token: string): string {
  if (/^[\w.-]+$/.test(token)) {
    return `HF_TOKEN=${token}`;
  }
  const escaped = token.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `HF_TOKEN="${escaped}"`;
}

/**
 * Merge `HF_TOKEN=value` into a KEY=VAL .env file without echoing the token in return value.
 * Replaces any existing HF_TOKEN line, including `export HF_TOKEN=...`.
 */
export async function mergeHfTokenIntoEnvFile(
  envPath: string,
  token: string,
): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(envPath, "utf8");
  } catch {
    existing = "";
  }
  const lines = existing.split(/\r?\n/);
  const next: string[] = [];
  let seen = false;
  const lineOut = formatHfTokenLine(token);
  for (const line of lines) {
    if (isHfTokenAssignmentLine(line)) {
      if (!seen) {
        next.push(lineOut);
        seen = true;
      }
    } else if (line.trim() !== "") {
      next.push(line);
    }
  }
  if (!seen) {
    next.push(lineOut);
  }
  const body = `${next.join("\n")}\n`;
  await fs.writeFile(envPath, body, { mode: 0o600, flag: "w" });
}

export async function hasHfTokenInFile(envPath: string): Promise<boolean> {
  const t = await readHfTokenFromFile(envPath);
  return t !== null;
}

/** Value of `HF_TOKEN` or `HUGGING_FACE_HUB_TOKEN` in the file, or `null` if both missing/empty. */
export async function readHfTokenFromFile(envPath: string): Promise<string | null> {
  const env = await loadEnvKeyValue(envPath);
  const v = env.HF_TOKEN ?? env.HUGGING_FACE_HUB_TOKEN;
  if (v === undefined || v.trim() === "") {
    return null;
  }
  return v;
}

/** Remove all `HF_TOKEN=...` / `export HF_TOKEN=...` lines from the file. */
export async function removeHfTokenFromEnvFile(envPath: string): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(envPath, "utf8");
  } catch {
    return;
  }
  const next = existing
    .split(/\r?\n/)
    .filter((line) => !isHfTokenAssignmentLine(line));
  const body = next.join("\n");
  await fs.writeFile(envPath, body === "" ? "" : `${body}\n`, { mode: 0o600, flag: "w" });
}

/**
 * Set or replace multiple `KEY=value` lines. Keys not in `updates` are left unchanged.
 * Does not remove unrelated lines (including `HF_TOKEN`).
 */
export async function mergeEnvKeysIntoEnvFile(
  envPath: string,
  updates: Record<string, string>,
): Promise<void> {
  const keys = new Set(Object.keys(updates));
  let existing = "";
  try {
    existing = await fs.readFile(envPath, "utf8");
  } catch {
    existing = "";
  }
  const lines = existing.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (m && keys.has(m[1]!)) {
      continue;
    }
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1] === "") {
    kept.pop();
  }
  const block = Object.entries(updates).map(([k, v]) => `${k}=${v}`);
  const body = (kept.length > 0 ? [...kept, ...block] : block).join("\n") + "\n";
  await fs.writeFile(envPath, body, { mode: 0o600, flag: "w" });
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    return null;
  }
  const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
  if (!m) {
    return null;
  }
  let v = m[2] ?? "";
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1);
  }
  return { key: m[1]!, value: v };
}

export async function loadEnvKeyValue(path: string): Promise<Record<string, string>> {
  let raw = "";
  try {
    raw = await fs.readFile(path, "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const p = parseEnvLine(line);
    if (p) {
      out[p.key] = p.value;
    }
  }
  return out;
}
