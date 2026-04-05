/**
 * Best-effort tok/s from vLLM Prometheus /metrics text.
 */

const TOKEN_LINE = /^(?:vllm:generation_tokens_total|vllm_generation_tokens_total)\{[^}]*\}\s+(\d+(?:\.\d+)?(?:e[+-]?\d+)?)/im;

export function parseGenerationTotal(text: string): number | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const m = TOKEN_LINE.exec(line);
    if (m) {
      const n = Number.parseFloat(m[1]!);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export class TokenRateTracker {
  private lastCount: number | null = null;
  private lastAt = 0;

  updateFromMetricsBody(body: string, now = Date.now()): number | null {
    const count = parseGenerationTotal(body);
    if (count === null) {
      return null;
    }
    if (this.lastCount === null || this.lastAt === 0) {
      this.lastCount = count;
      this.lastAt = now;
      return null;
    }
    const dt = (now - this.lastAt) / 1000;
    if (dt <= 0) return null;
    const delta = count - this.lastCount;
    this.lastCount = count;
    this.lastAt = now;
    if (delta < 0) return null;
    return delta / dt;
  }

  reset(): void {
    this.lastCount = null;
    this.lastAt = 0;
  }
}
