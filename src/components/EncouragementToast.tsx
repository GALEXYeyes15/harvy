import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { EncouragementPhrase } from "../features/encouragement/encouragementSettings";

type EncouragementToastProps = {
  phrase: EncouragementPhrase | null;
  onDismiss: () => void;
  /** Auto-hide after this many ms. */
  durationMs?: number;
};

/**
 * Top-right text-message style encouragement banner.
 */
export function EncouragementToast({
  phrase,
  onDismiss,
  durationMs = 7000,
}: EncouragementToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!phrase) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const hide = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onDismiss, 280);
    }, durationMs);
    return () => window.clearTimeout(hide);
  }, [phrase, durationMs, onDismiss]);

  if (!phrase || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed right-4 top-4 z-[320] flex max-w-[min(22rem,calc(100vw-2rem))] flex-col items-end"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        role="status"
        className={`pointer-events-auto origin-top-right rounded-[1.15rem] bg-page px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line/40 transition-[opacity,transform] duration-300 ease-out dark:bg-page dark:ring-white/10 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/70">
            Encouragement
          </p>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              window.setTimeout(onDismiss, 200);
            }}
            className="rounded-md px-1.5 py-0.5 text-[11px] text-muted/60 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            aria-label="Dismiss encouragement"
          >
            Close
          </button>
        </div>
        <p className="text-[14px] font-medium leading-snug tracking-tight text-ink">
          “{phrase.text}”
        </p>
        <p className="mt-2 text-right text-[12px] font-normal text-muted/80">— {phrase.author}</p>
      </div>
    </div>,
    document.body,
  );
}
