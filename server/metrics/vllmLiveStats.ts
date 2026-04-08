/**
 * Parse additional vLLM Prometheus /metrics gauges (best-effort; names vary by vLLM version).
 *
 * Legacy (e.g. 0.6.x): `vllm:gpu_cache_usage_perc`, `vllm:cpu_cache_usage_perc`,
 * `vllm:gpu_prefix_cache_hit_rate` gauges.
 *
 * V1 engine (current main): `vllm:kv_cache_usage_perc` (replaces GPU gauge name),
 * prefix cache as counters `vllm:prefix_cache_hits` / `vllm:prefix_cache_queries` (rate = hits/queries).
 */
import type { VllmLiveStats } from "../../types/index.js";
import { parseTimeToFirstTokenP95Seconds } from "./vllmHistogram.js";

function lineScalarValue(line: string): number | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) {
    return null;
  }
  const parts = t.split(/\s+/);
  const last = parts[parts.length - 1];
  if (last === undefined) {
    return null;
  }
  const n = Number.parseFloat(last);
  return Number.isFinite(n) ? n : null;
}

/** Metric token before labels, e.g. `vllm:foo{a="b"}` -> `vllm:foo`. */
function lineMetricName(line: string): string | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) {
    return null;
  }
  const token = t.split(/\s+/, 1)[0];
  if (!token) {
    return null;
  }
  const brace = token.indexOf("{");
  return brace >= 0 ? token.slice(0, brace) : token;
}

function isHistogramSeries(metricName: string): boolean {
  return (
    metricName.endsWith("_bucket") ||
    metricName.endsWith("_sum") ||
    metricName.endsWith("_count")
  );
}

/** First sample for exact metric names (supports optional labels). */
function pickMetricByNames(text: string, metricNames: string[]): number | null {
  const names = new Set(metricNames);
  for (const line of text.split(/\r?\n/)) {
    const metricName = lineMetricName(line);
    if (!metricName || !names.has(metricName) || isHistogramSeries(metricName)) {
      continue;
    }
    const v = lineScalarValue(line);
    if (v !== null) {
      return v;
    }
  }
  return null;
}

/** Sum all samples for exact metric names (for per-engine/per-label gauges). */
function sumMetricByNames(text: string, metricNames: string[]): number | null {
  const names = new Set(metricNames);
  let sum = 0;
  let found = false;
  for (const line of text.split(/\r?\n/)) {
    const metricName = lineMetricName(line);
    if (!metricName || !names.has(metricName) || isHistogramSeries(metricName)) {
      continue;
    }
    const v = lineScalarValue(line);
    if (v !== null) {
      sum += v;
      found = true;
    }
  }
  return found ? sum : null;
}

/**
 * First gauge/counter line for `needle` (metric name fragment), skipping histogram
 * `_bucket` / `_sum` lines so we do not read a cumulative bucket as the gauge value.
 */
function pickMetric(text: string, needle: string): number | null {
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes(needle)) {
      continue;
    }
    if (/^#/.test(line)) {
      continue;
    }
    if (/\b_bucket\b/.test(line) || /\b_sum\b/.test(line) || /\b_count\b/.test(line)) {
      continue;
    }
    const v = lineScalarValue(line);
    if (v !== null) {
      return v;
    }
  }
  return null;
}

/** Try several name fragments (first match wins). */
function pickMetricAny(text: string, needles: string[]): number | null {
  for (const n of needles) {
    const v = pickMetric(text, n);
    if (v !== null) {
      return v;
    }
  }
  return null;
}

/**
 * V1 exposes prefix hit rate via counters, not a gauge. Use hits/queries across all engines.
 * Fragment must not match `external_prefix_cache_*` (e.g. `:prefix_cache_hits{` is unique).
 */
function prefixHitRateFromV1Counters(text: string): number | null {
  // Support both labeled and unlabeled series names and avoid matching external_prefix_cache_*.
  const hits = sumMetricByNames(text, ["vllm:prefix_cache_hits", "prefix_cache_hits"]);
  const queries = sumMetricByNames(text, [
    "vllm:prefix_cache_queries",
    "prefix_cache_queries",
  ]);
  if (hits === null || queries === null || queries <= 0) {
    return null;
  }
  return hits / queries;
}

export function parseVllmLiveStatsFromPrometheus(text: string): VllmLiveStats {
  const gpuKv = pickMetricAny(text, [
    "kv_cache_usage_perc",
    "gpu_cache_usage_perc",
  ]);
  const cpuKv = pickMetric(text, "cpu_cache_usage_perc");
  const run = sumMetricByNames(text, ["vllm:num_requests_running", "num_requests_running"]);
  const wait = sumMetricByNames(text, ["vllm:num_requests_waiting", "num_requests_waiting"]);
  const promptTot = pickMetric(text, "prompt_tokens_total");
  const genTot = pickMetric(text, "generation_tokens_total");

  // CPU-only gauge is read only into cpuPrefixCacheHitRateFrac (not duplicated here).
  const prefixHit =
    prefixHitRateFromV1Counters(text) ??
    pickMetricAny(text, [
      "gpu_prefix_cache_hit_rate",
      "prefix_cache_hit_rate",
      "vllm_gpu_prefix_cache_hit_rate",
    ]);
  const cpuPrefixGauge = pickMetricByNames(text, [
    "vllm:cpu_prefix_cache_hit_rate",
    "cpu_prefix_cache_hit_rate",
  ]);
  const swapped = sumMetricByNames(text, ["vllm:num_requests_swapped", "num_requests_swapped"]);
  const ttftP95 = parseTimeToFirstTokenP95Seconds(text);

  return {
    gpuCacheUsageFrac: gpuKv,
    cpuCacheUsageFrac: cpuKv,
    gpuPrefixCacheHitRateFrac: prefixHit,
    cpuPrefixCacheHitRateFrac: cpuPrefixGauge,
    timeToFirstTokenP95Seconds: ttftP95,
    numRequestsRunning: run,
    numRequestsWaiting: wait,
    numRequestsSwapped: swapped,
    promptTokensTotal: promptTot,
    generationTokensTotal: genTot,
  };
}
