import fs from "node:fs";
import type { AppConfig } from "./config.js";

export interface Paths {
  sparkRoot: string;
  recipesDir: string;
  runRecipePy: string;
  runRecipeSh: string;
  envFile: string;
  tempRunsDir: string;
}

/** Resolved paths from env + `SPARK_VLLM_ROOT` (see `loadConfig`). */
export function buildPaths(cfg: AppConfig): Paths {
  return {
    sparkRoot: cfg.sparkVllmRoot,
    recipesDir: cfg.recipesDir,
    runRecipePy: cfg.runRecipePy,
    runRecipeSh: cfg.runRecipeSh,
    envFile: cfg.envFile,
    tempRunsDir: cfg.tempRunsDir,
  };
}

export function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}
