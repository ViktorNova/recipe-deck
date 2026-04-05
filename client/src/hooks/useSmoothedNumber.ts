import { useEffect, useState } from "react";

/**
 * Exponential smoothing for jittery live metrics (lower alpha = smoother, slower).
 */
export function useSmoothedNumber(value: number | null, alpha = 0.2): number | null {
  const [smoothed, setSmoothed] = useState<number | null>(null);
  useEffect(() => {
    if (value === null || !Number.isFinite(value)) {
      setSmoothed(null);
      return;
    }
    setSmoothed((prev) => (prev == null ? value : prev + alpha * (value - prev)));
  }, [value, alpha]);
  return smoothed;
}
