import type { ReactElement } from "react";
import type { MetricsPayload, SlotSnapshot } from "../../../../types/index.js";
import { formatBytes } from "../../lib/formatBytes";
import { useSmoothedNumber } from "../../hooks/useSmoothedNumber";
import { useSessionPeak } from "../../hooks/useSessionPeak";
import { DbLevelMeter } from "./DbLevelMeter";
import styles from "./LiveStatsPanel.module.css";

export interface LiveStatsPanelProps {
  snap: SlotSnapshot;
  metrics: MetricsPayload | null;
}

function fmtPctFrac(frac: number | null): string {
  if (frac === null || !Number.isFinite(frac)) {
    return "—";
  }
  const pct = frac <= 1 && frac >= 0 ? frac * 100 : frac;
  return `${pct.toFixed(1)}%`;
}

function fmtInt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) {
    return "—";
  }
  return String(Math.round(n));
}

function fmtTok(n: number | null): string {
  if (n === null || !Number.isFinite(n)) {
    return "—";
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function clamp01(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) {
    return null;
  }
  return Math.max(0, Math.min(1, n));
}

function fmtPeakTokPerSec(p: number): string {
  if (!Number.isFinite(p) || p <= 0) {
    return "—";
  }
  return `${p.toFixed(1)} tok/s`;
}

/** Peak stored as 0–1 fraction (same as live gauge). */
function fmtPeakPercentFrac(p: number): string {
  if (!Number.isFinite(p) || p <= 0) {
    return "—";
  }
  const pct = p <= 1 ? p * 100 : p;
  return `${pct.toFixed(1)}%`;
}

function fmtPeakRequestsPair(runP: number, waitP: number): string {
  const r = Number.isFinite(runP) ? Math.max(0, runP) : 0;
  const w = Number.isFinite(waitP) ? Math.max(0, waitP) : 0;
  if (r <= 0 && w <= 0) {
    return "—";
  }
  return `${Math.round(r)} / ${Math.round(w)}`;
}

export function LiveStatsPanel(props: LiveStatsPanelProps): ReactElement {
  const { snap, metrics } = props;
  const ls = snap.liveStats;
  const gpu = metrics?.gpu ?? null;
  const disk = metrics?.disk ?? null;

  const tokRaw = snap.tokPerSec;
  const tokSm = useSmoothedNumber(tokRaw, 0.22);

  const meterActive = snap.phase === "HEALTHY" && ls != null;

  const tokCur = tokSm ?? tokRaw ?? null;
  const tokPeak = useSessionPeak(tokCur, meterActive);
  const tokFrac =
    tokCur != null && Number.isFinite(tokCur) && tokPeak > 0 ? Math.max(0, tokCur) / tokPeak : 0;

  const gpuCur = clamp01(ls?.gpuCacheUsageFrac);
  const gpuPeak = useSessionPeak(gpuCur, meterActive);
  const gpuFrac = gpuCur != null && gpuPeak > 0 ? gpuCur / gpuPeak : 0;

  const cpuCur = clamp01(ls?.cpuCacheUsageFrac);
  const cpuPeak = useSessionPeak(cpuCur, meterActive);
  const cpuFrac = cpuCur != null && cpuPeak > 0 ? cpuCur / cpuPeak : 0;

  const runN = ls?.numRequestsRunning ?? null;
  const waitN = ls?.numRequestsWaiting ?? null;
  const runPeak = useSessionPeak(runN, meterActive);
  const waitPeak = useSessionPeak(waitN, meterActive);
  const runFrac =
    runN != null && Number.isFinite(runN) && runPeak > 0 ? Math.max(0, runN) / runPeak : 0;
  const waitFrac =
    waitN != null && Number.isFinite(waitN) && waitPeak > 0 ? Math.max(0, waitN) / waitPeak : 0;

  const prefCur = clamp01(ls?.gpuPrefixCacheHitRateFrac);
  const prefPeak = useSessionPeak(prefCur, meterActive);
  const prefFrac = prefCur != null && prefPeak > 0 ? prefCur / prefPeak : 0;

  return (
    <section
      className={styles.panel}
      aria-label="Live inference stats"
      data-testid="live-stats-panel"
    >
      <div className={styles.head}>
        <h2 className={styles.h2}>Live stats</h2>
        {snap.servedModels?.length ? (
          <p className={styles.sub}>{snap.servedModels.join(", ")}</p>
        ) : null}
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardWithMeter}`}>
          <DbLevelMeter fraction={tokFrac} />
          <div className={styles.cardForeground}>
            <span className={styles.cardLabel}>Throughput</span>
            <span className={styles.cardValue} title={tokRaw != null ? `Raw: ${tokRaw} tok/s` : undefined}>
              {tokSm != null ? `${tokSm.toFixed(1)} tok/s` : "—"}
            </span>
            <span className={styles.cardPeak} title="Highest tok/s this session (HEALTHY)">
              Peak {fmtPeakTokPerSec(tokPeak)}
            </span>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardWithMeter}`}>
          <DbLevelMeter fraction={gpuFrac} />
          <div className={styles.cardForeground}>
            <span className={styles.cardLabel}>GPU KV cache</span>
            <span className={styles.cardValue}>{fmtPctFrac(ls?.gpuCacheUsageFrac ?? null)}</span>
            <span className={styles.cardPeak} title="Highest GPU KV usage this session (HEALTHY)">
              Peak {fmtPeakPercentFrac(gpuPeak)}
            </span>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardWithMeter}`}>
          <DbLevelMeter fraction={cpuFrac} />
          <div className={styles.cardForeground}>
            <span className={styles.cardLabel}>CPU KV cache</span>
            <span className={styles.cardValue}>{fmtPctFrac(ls?.cpuCacheUsageFrac ?? null)}</span>
            <span className={styles.cardPeak} title="Highest CPU KV usage this session (HEALTHY)">
              Peak {fmtPeakPercentFrac(cpuPeak)}
            </span>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardWithMeter}`}>
          <DbLevelMeter stereoFractions={[runFrac, waitFrac]} />
          <div className={styles.cardForeground}>
            <span className={styles.cardLabel}>Requests</span>
            <span className={styles.cardValue}>
              {fmtInt(ls?.numRequestsRunning ?? null)}
              <span className={styles.cardSep}>/</span>
              {fmtInt(ls?.numRequestsWaiting ?? null)}
            </span>
            <span
              className={styles.cardPeak}
              title="Highest running · waiting counts this session (HEALTHY), same order as above"
            >
              Peak {fmtPeakRequestsPair(runPeak, waitPeak)}
            </span>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardWithMeter}`}>
          <DbLevelMeter fraction={prefFrac} />
          <div className={styles.cardForeground}>
            <span className={styles.cardLabel}>Prefix cache hit</span>
            <span className={styles.cardValue}>
              {fmtPctFrac(ls?.gpuPrefixCacheHitRateFrac ?? null)}
            </span>
            <span className={styles.cardPeak} title="Highest prefix hit rate this session (HEALTHY)">
              Peak {fmtPeakPercentFrac(prefPeak)}
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Tokens (cumulative)</span>
          <span className={styles.cardValueStack} title="Prompt tokens · generation tokens (cumulative)">
            <span>{fmtTok(ls?.promptTokensTotal ?? null)}</span>
            <span className={styles.cardSepLine} aria-hidden>
              ·
            </span>
            <span>{fmtTok(ls?.generationTokensTotal ?? null)}</span>
          </span>
        </div>
      </div>

      {gpu || disk ? (
        <div className={styles.footMeta}>
          {gpu ? (
            <span title="Host GPU (nvidia-smi)">
              GPU
              {gpu.temperatureC != null ? ` ${gpu.temperatureC}°C` : ""}
              {gpu.utilizationPct != null ? ` · ${gpu.utilizationPct}%` : ""}
              {gpu.memUsedMiB != null && gpu.memTotalMiB != null
                ? ` · ${Math.round(gpu.memUsedMiB)}/${Math.round(gpu.memTotalMiB)} MiB`
                : ""}
            </span>
          ) : null}
          {gpu && disk ? <span aria-hidden> · </span> : null}
          {disk ? (
            <span title={disk.path}>
              Disk {formatBytes(disk.freeBytes)} free / {formatBytes(disk.totalBytes)}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
