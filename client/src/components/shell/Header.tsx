import type { ReactElement } from "react";
import type { MetricsPayload } from "../../../../types/index.js";
import { formatListenDisplay } from "../../../../shared/formatListenDisplay";
import { formatBytes } from "../../lib/formatBytes";
import type { Theme } from "../../theme";
import styles from "./Header.module.css";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.0.0";

export interface HeaderProps {
  listenHost?: string;
  listenPort: number;
  metrics: MetricsPayload | null;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenServerSettings: () => void;
  onOpenHelp: () => void;
}

function IconSun(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconGear(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconMoon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function Header(props: HeaderProps): ReactElement {
  const {
    listenHost,
    listenPort,
    metrics,
    theme,
    onToggleTheme,
    onOpenServerSettings,
    onOpenHelp,
  } = props;
  const disk = metrics?.disk;
  const gpu = metrics?.gpu;
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.titleRow}>
          <span className={styles.title}>Recipe Deck</span>
          <span className={styles.appVersion} title="Recipe Deck UI version">
            v{APP_VERSION}
          </span>
        </div>
        <span className={styles.port} title="HTTP bind (SWITCHER_HOST:SWITCHER_PORT)">
          UI · {formatListenDisplay(listenHost ?? "0.0.0.0", listenPort)}
        </span>
      </div>
      <div className={styles.strip}>
        <button
          type="button"
          className={styles.gearBtn}
          onClick={onOpenServerSettings}
          title="Settings"
          aria-label="Settings"
        >
          <IconGear />
        </button>
        <button
          type="button"
          className={styles.helpBtn}
          onClick={onOpenHelp}
          title="About & help"
          aria-label="About and help"
        >
          ?
        </button>
        <button
          type="button"
          className={styles.themeBtn}
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        {disk ? (
          <span className={styles.chip} title={disk.path}>
            Disk {formatBytes(disk.freeBytes)} free / {formatBytes(disk.totalBytes)}
          </span>
        ) : (
          <span className={styles.chipMuted}>Disk —</span>
        )}
        {gpu ? (
          <span className={styles.chip}>
            GPU
            {gpu.gpuCount != null && gpu.gpuCount > 1 ? ` ×${gpu.gpuCount}` : ""}{" "}
            {gpu.temperatureC != null ? `${gpu.temperatureC}°C` : "—"}
            {gpu.utilizationPct != null ? ` · ${gpu.utilizationPct}%` : ""}
            {gpu.memUsedMiB != null && gpu.memTotalMiB != null
              ? ` · VRAM ${Math.round(gpu.memUsedMiB)}/${Math.round(gpu.memTotalMiB)} MiB`
              : ""}
          </span>
        ) : (
          <span className={styles.chipMuted}>GPU n/a</span>
        )}
      </div>
    </header>
  );
}
