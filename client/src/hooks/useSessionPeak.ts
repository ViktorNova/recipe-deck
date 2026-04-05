import { useEffect, useState } from "react";

/**
 * Tracks the session maximum of `value` while `active` is true; resets when `active` becomes false.
 */
export function useSessionPeak(value: number | null | undefined, active: boolean): number {
  const [peak, setPeak] = useState(0);

  useEffect(() => {
    if (!active) {
      setPeak(0);
    }
  }, [active]);

  useEffect(() => {
    if (!active || value == null || !Number.isFinite(value)) {
      return;
    }
    setPeak((p) => (value > p ? value : p));
  }, [value, active]);

  return peak;
}
