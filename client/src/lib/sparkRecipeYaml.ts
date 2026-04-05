import YAML from "yaml";

export function safeParseYaml(text: string): Record<string, unknown> {
  if (!text.trim()) {
    return {};
  }
  const v = YAML.parse(text);
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return {};
  }
  return v as Record<string, unknown>;
}

export function stringifyRecipe(doc: Record<string, unknown>): string {
  return YAML.stringify(doc, { lineWidth: 0 });
}

export function modsToLines(mods: unknown): string {
  if (!Array.isArray(mods)) {
    return "";
  }
  return mods.map(String).join("\n");
}

export function linesToMods(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** env object → KEY=value lines */
export function envToLines(env: unknown): string {
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    return "";
  }
  return Object.entries(env as Record<string, unknown>)
    .map(([k, v]) => `${k}=${v === undefined ? "" : String(v)}`)
    .join("\n");
}

export function linesToEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (k) {
      out[k] = v;
    }
  }
  return out;
}

export function buildArgsToLines(args: unknown): string {
  if (!Array.isArray(args)) {
    return "";
  }
  return args.map(String).join("\n");
}

export function linesToBuildArgs(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function defaultsToYaml(defaults: unknown): string {
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    return "";
  }
  return YAML.stringify(defaults, { lineWidth: 0 }).trim();
}

/** Keys edited via structured form controls (not the freeform defaults textarea). */
export const DEFAULTS_STRUCTURED_KEYS = [
  "max_model_len",
  "max_num_batched_tokens",
  "enforce_eager",
] as const;

export type DefaultsStructuredKey = (typeof DEFAULTS_STRUCTURED_KEYS)[number];

export function getDefaultsObject(defaults: unknown): Record<string, unknown> {
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    return {};
  }
  return { ...(defaults as Record<string, unknown>) };
}

/** Defaults blob for the freeform textarea (omits keys shown as dropdowns/toggles). */
export function defaultsToYamlRest(defaults: unknown): string {
  const o = omitDefaultsKeys(defaults, [...DEFAULTS_STRUCTURED_KEYS]);
  if (Object.keys(o).length === 0) {
    return "";
  }
  return YAML.stringify(o, { lineWidth: 0 }).trim();
}

export function omitDefaultsKeys(defaults: unknown, keys: readonly string[]): Record<string, unknown> {
  const base = getDefaultsObject(defaults);
  const out = { ...base };
  for (const k of keys) {
    delete out[k];
  }
  return out;
}

export function parseDefaultsYaml(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t) {
    return {};
  }
  try {
    const v = YAML.parse(t);
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return null;
    }
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}
