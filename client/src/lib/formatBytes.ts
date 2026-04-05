/** Human-readable byte size (base-10, same as Header metrics). */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    return "—";
  }
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}
