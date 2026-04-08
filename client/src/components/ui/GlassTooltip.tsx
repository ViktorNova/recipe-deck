import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import styles from "./GlassTooltip.module.css";

export interface GlassTooltipProps {
  /** Hover / focus hint (glass-styled). */
  label: string;
  children: ReactNode;
}

/**
 * Wraps a control and shows a glassmorphism tooltip on hover and keyboard focus.
 * Renders the tooltip in a portal so it stacks above the fixed header.
 */
export function GlassTooltip(props: GlassTooltipProps): ReactElement {
  const { label, children } = props;
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Pointer hover delay before the tooltip appears. */
  const SHOW_DELAY_MS = 3000;

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const syncPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    const gap = 8;
    setCoords({ left: r.left + r.width / 2, top: r.bottom + gap });
  }, []);

  const showSoon = useCallback(() => {
    clearShowTimer();
    setFadeOut(false);
    showTimerRef.current = setTimeout(() => {
      setOpen(true);
      showTimerRef.current = null;
    }, SHOW_DELAY_MS);
  }, [clearShowTimer]);

  const showNow = useCallback(() => {
    clearShowTimer();
    setFadeOut(false);
    setOpen(true);
  }, [clearShowTimer]);

  /** Pointer left: stop pending show and immediately start fade-out when visible. */
  const hideSoon = useCallback(() => {
    clearShowTimer();
    if (!open) {
      setFadeOut(false);
      return;
    }
    setFadeOut(true);
  }, [clearShowTimer, open]);

  const hideNow = useCallback(() => {
    clearShowTimer();
    setFadeOut(false);
    setOpen(false);
    setCoords(null);
  }, [clearShowTimer]);

  const onTipTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "opacity" || !fadeOut) {
        return;
      }
      setOpen(false);
      setFadeOut(false);
      setCoords(null);
    },
    [fadeOut],
  );

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    syncPosition();
    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("resize", syncPosition);
    return () => {
      window.removeEventListener("scroll", syncPosition, true);
      window.removeEventListener("resize", syncPosition);
    };
  }, [open, label, syncPosition]);

  return (
    <>
      <span
        ref={wrapRef}
        className={styles.wrap}
        onMouseEnter={showSoon}
        onMouseLeave={hideSoon}
        onFocus={showNow}
        onBlur={hideNow}
      >
        {children}
      </span>
      {open && coords != null
        ? createPortal(
            <div
              className={`${styles.tipFixed} ${fadeOut ? styles.tipFadeOut : ""}`}
              role="tooltip"
              style={{
                left: coords.left,
                top: coords.top,
              }}
              onTransitionEnd={onTipTransitionEnd}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
