import { spawn } from "node:child_process";
import type { Response } from "express";

function systemdUnit(): string {
  const u = process.env.RECIPE_DECK_SYSTEMD_UNIT ?? "recipe-deck.service";
  return /^[a-zA-Z0-9._@-]+$/.test(u) ? u : "recipe-deck.service";
}

/**
 * After `res` finishes sending, run `systemctl --user restart <unit>`.
 * Call this before `res.json(...)` so the `finish` listener is registered first.
 */
export function scheduleRestartAfterResponse(res: Response): void {
  res.once("finish", () => {
    const child = spawn("systemctl", ["--user", "restart", systemdUnit()], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  });
}
