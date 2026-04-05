import type { FullStatePayload } from "../api/client.js";
import type { SlotPhase, SlotSnapshot } from "../../../types/index.js";

/** Managed vLLM runner state from `/api/state` (JSON `slots.a`). */
export function runnerSnapshot(
  p: FullStatePayload | null | undefined,
): SlotSnapshot | undefined {
  return p?.slots.a;
}

export function runnerPhase(
  p: FullStatePayload | null | undefined,
): SlotPhase | undefined {
  return p?.slots.a.phase;
}
