import { X } from "lucide-react";
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
        className={`group relative pointer-events-auto origin-top-right rounded-[1.15rem] bg-page px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line/40 transition-[opacity,transform] duration-300 ease-out dark:bg-page dark:ring-white/10 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            window.setTimeout(onDismiss, 200);
          }}
          className="absolute right-0 top-0 flex size-[22px] -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-page text-ink opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.25)] ring-1 ring-line/55 transition-opacity duration-150 hover:bg-ink/[0.04] group-hover:opacity-100 focus-visible:opacity-100 dark:bg-page dark:ring-white/25 dark:hover:bg-white/[0.06]"
          aria-label="Dismiss encouragement"
        >
          <X size={12} strokeWidth={1.75} aria-hidden />
        </button>
        <p className="text-[14px] font-medium leading-snug tracking-tight text-ink">
          “{phrase.text}”
        </p>
        <p className="mt-2 text-right text-[12px] font-normal text-muted/80">— {phrase.author}</p>
      </div>
    </div>,
    document.body,
  );
}
