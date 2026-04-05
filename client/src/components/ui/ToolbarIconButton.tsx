import type { ReactElement, ReactNode } from "react";
import { GlassTooltip } from "./GlassTooltip.js";
import styles from "./ToolbarIconButton.module.css";

export type ToolbarIconVariant = "muted" | "accent" | "danger";

export interface ToolbarIconButtonProps {
  /** Shown in glass tooltip and as aria-label. */
  label: string;
  variant?: ToolbarIconVariant;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function ToolbarIconButton(props: ToolbarIconButtonProps): ReactElement {
  const { label, variant = "muted", disabled, busy, onClick, children } = props;
  const cls =
    variant === "accent"
      ? styles.accent
      : variant === "danger"
        ? styles.danger
        : styles.muted;
  return (
    <GlassTooltip label={label}>
      <button
        type="button"
        className={`${cls}${busy ? ` ${styles.busy}` : ""}`}
        disabled={disabled}
        aria-label={label}
        aria-busy={busy || undefined}
        onClick={onClick}
      >
        {children}
      </button>
    </GlassTooltip>
  );
}
