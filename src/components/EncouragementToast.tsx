import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EncouragementPhrase } from "../features/encouragement/encouragementSettings";
import { TOOLS_SIDEBAR_WIDTH_PX } from "../features/workspace/workspaceSection";

/** Inset from the window’s right edge so the bubble isn’t flush. */
const TOAST_RIGHT_INSET_PX = 12;

type EncouragementToastProps = {
  phrase: EncouragementPhrase | null;
  onDismiss: () => void;
  /** Auto-hide after this many ms (pauses while hovered). */
  durationMs?: number;
};

/**
 * Top-right text-message style encouragement banner.
 * Width matches the right tools sidebar (minus a small right inset) regardless of phrase length.
 */
export function EncouragementToast({
  phrase,
  onDismiss,
  durationMs = 7000,
}: EncouragementToastProps) {
  const [visible, setVisible] = useState(false);
  const remainingMsRef = useRef(durationMs);
  const hideDeadlineRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const dismissTimeoutRef = useRef<number | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!phrase) {
      setVisible(false);
      return;
    }

    setVisible(true);
    remainingMsRef.current = durationMs;
    hideDeadlineRef.current = null;

    const clearTimers = () => {
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      if (dismissTimeoutRef.current != null) {
        window.clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
    };

    const beginDismiss = () => {
      setVisible(false);
      dismissTimeoutRef.current = window.setTimeout(() => {
        onDismissRef.current();
      }, 280);
    };

    const scheduleHide = () => {
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
      hideDeadlineRef.current = Date.now() + remainingMsRef.current;
      hideTimeoutRef.current = window.setTimeout(beginDismiss, remainingMsRef.current);
    };

    scheduleHide();
    return clearTimers;
  }, [phrase, durationMs]);

  const pauseHide = () => {
    if (hideTimeoutRef.current != null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (hideDeadlineRef.current != null) {
      remainingMsRef.current = Math.max(0, hideDeadlineRef.current - Date.now());
      hideDeadlineRef.current = null;
    }
  };

  const resumeHide = () => {
    if (hideTimeoutRef.current != null) return;
    const remaining = remainingMsRef.current;
    if (remaining <= 0) {
      setVisible(false);
      dismissTimeoutRef.current = window.setTimeout(() => {
        onDismissRef.current();
      }, 280);
      return;
    }
    hideDeadlineRef.current = Date.now() + remaining;
    hideTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      dismissTimeoutRef.current = window.setTimeout(() => {
        onDismissRef.current();
      }, 280);
    }, remaining);
  };

  if (!phrase || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed top-4 z-[320] flex flex-col items-stretch"
      style={{
        right: TOAST_RIGHT_INSET_PX,
        width: TOOLS_SIDEBAR_WIDTH_PX - TOAST_RIGHT_INSET_PX,
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        role="status"
        onMouseEnter={pauseHide}
        onMouseLeave={resumeHide}
        className={`group relative w-full pointer-events-auto origin-top-right rounded-[1.15rem] bg-page px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line/40 transition-[opacity,transform] duration-300 ease-out dark:bg-page dark:ring-white/10 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            pauseHide();
            setVisible(false);
            window.setTimeout(() => onDismissRef.current(), 200);
          }}
          className="absolute left-0 top-0 flex size-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-page text-ink opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.25)] ring-1 ring-line/55 transition-opacity duration-150 hover:bg-ink/[0.04] group-hover:opacity-100 focus-visible:opacity-100 dark:bg-page dark:ring-white/25 dark:hover:bg-white/[0.06]"
          aria-label="Dismiss encouragement"
        >
          <X size={12} strokeWidth={1.75} aria-hidden />
        </button>
        <p className="text-[13px] font-semibold leading-snug tracking-tight text-ink">
          {phrase.author}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] font-normal leading-snug text-ink/90">
          {phrase.text}
        </p>
      </div>
    </div>,
    document.body,
  );
}
