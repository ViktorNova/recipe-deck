import type { SlotId } from "./slot.js";

export type ServerToClientMessage =
  | { type: "log"; slot: SlotId; line: string }
  /** Full ring-buffer text for this slot (sent once per new WebSocket connection). */
  | { type: "log_snapshot"; slot: SlotId; text: string }
  | { type: "state"; payload: unknown };
