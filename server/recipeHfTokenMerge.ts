import YAML from "yaml";
import type { Paths } from "./paths.js";
import { readHfTokenFromFile } from "./envMerge.js";

/**
 * Resolve Hugging Face token for recipe injection: `$SPARK_VLLM_ROOT/.env` first,
 * then process env (Recipe Deck loads `.env` at startup, but the file may be
 * updated when the UI saves the token without a full process restart).
 */
export async function resolveHfTokenForRecipe(paths: Paths): Promise<string | null> {
  const fromFile = await readHfTokenFromFile(paths.envFile);
  if (fromFile) {
    return fromFile;
  }
  const p = process.env.HF_TOKEN ?? process.env.HUGGING_FACE_HUB_TOKEN;
  if (p !== undefined && p.trim() !== "") {
    return p.trim();
  }
  return null;
}

/** Spark recipes often use `HF_TOKEN: ${HF_TOKEN}` so run-recipe expands from the shell — that only works if the token is already in the environment where the launch script runs (not true inside Docker). Recipe Deck must inject the real secret in that case. */
const HF_ENV_PLACEHOLDER = /^\$\{(HF_TOKEN|HUGGING_FACE_HUB_TOKEN)\}$/;

function envHasResolvedHubAuth(e: Record<string, unknown>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(e, key)) {
    return false;
  }
  const v = e[key];
  if (v === undefined || v === null) {
    return false;
  }
  const s = String(v).trim();
  if (s === "") {
    return false;
  }
  if (HF_ENV_PLACEHOLDER.test(s)) {
    return false;
  }
  return true;
}

/** True if recipe `env` already has a literal HF or Hub token (not a `${...}` placeholder). */
function recipeHasHfToken(env: unknown): boolean {
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    return false;
  }
  const e = env as Record<string, unknown>;
  return (
    envHasResolvedHubAuth(e, "HF_TOKEN") ||
    envHasResolvedHubAuth(e, "HUGGING_FACE_HUB_TOKEN")
  );
}

/**
 * If the YAML has no resolved `env.HF_TOKEN` / `env.HUGGING_FACE_HUB_TOKEN`
 * (missing, empty, or `${HF_TOKEN}`-style placeholders), set `env.HF_TOKEN`
 * to the resolved token so `run-recipe.py` emits a literal `export HF_TOKEN=...`
 * in the launch script — required for Docker where the shell indirection would
 * otherwise expand to empty.
 *
 * Returns merged YAML text, or `null` if no injection was needed / parse failed.
 */
export function injectHfTokenIntoRecipeYaml(yamlText: string, token: string | null): string | null {
  if (!token || token.trim() === "") {
    return null;
  }
  let doc: unknown;
  try {
    doc = YAML.parse(yamlText);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return null;
  }
  const r = doc as Record<string, unknown>;
  const env =
    r.env && typeof r.env === "object" && !Array.isArray(r.env)
      ? { ...(r.env as Record<string, unknown>) }
      : {};
  if (recipeHasHfToken(env)) {
    return null;
  }
  r.env = { ...env, HF_TOKEN: token };
  return YAML.stringify(doc);
}
