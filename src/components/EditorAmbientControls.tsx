import { Check, Clock, Copy } from "lucide-react";
import { SidebarLayoutIcon } from "./SidebarLayoutIcon";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";

/** Idle wait (ms) before starting the 1s reveal animation. */
const IDLE_BEFORE_REVEAL_MS = 2000;
/** How long to show the checkmark after a successful copy. */
const COPY_SUCCESS_MS = 1200;

const ICON_SIZE = 19;
const ICON_STROKE = 1.5;

/** Theme-aware icons on the ambient pill (dark appearance unchanged via semantic tokens). */
const ICON_BTN =
  "pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted opacity-90 transition-[opacity,background-color,color] duration-200 hover:bg-ink/[0.08] hover:opacity-100 hover:text-ink dark:hover:bg-white/[0.08] dark:hover:text-ink";

/** Solid surface aligned with workspace stage — no border, shadow, or outline. */
const PILL_SURFACE = "rounded-full bg-stage px-4 py-1.5 sm:px-5";

type EditorAmbientControlsProps = {
  /** Parent-owned ref; this component assigns the idle/typing handler so `EditorCanvas` can invoke it. */
  activityHandlerRef: MutableRefObject<(() => void) | null>;
  /** Unified workspace + readability rail visibility (bottom bar first control). */
  onToggleBothSidebars: () => void;
  /** Copy full document to clipboard (rich HTML + plain text when supported). */
  onCopyDocument: () => Promise<boolean>;
  /** When true, use AppShell chrome visibility instead of local idle/typing reveal timing. */
  syncWithChrome?: boolean;
  /** Shared chrome hidden state from AppShell (top + bottom unified). */
  chromeHidden?: boolean;
};

/**
 * Bottom-center grouped controls: 2s idle, then 1s ease-out fade/slide into view; hide immediately on input.
 */
export function EditorAmbientControls({
  activityHandlerRef,
  onToggleBothSidebars,
  onCopyDocument,
  syncWithChrome,
  chromeHidden,
}: EditorAmbientControlsProps) {
  const [showControls, setShowControls] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleReveal = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      setShowControls(true);
    }, IDLE_BEFORE_REVEAL_MS);
  }, [clearIdleTimer]);

  const onTypingActivity = useCallback(() => {
    setShowControls(false);
    scheduleReveal();
  }, [scheduleReveal]);

  useLayoutEffect(() => {
    activityHandlerRef.current = onTypingActivity;
    return () => {
      activityHandlerRef.current = null;
    };
  }, [activityHandlerRef, onTypingActivity]);

  /** Same 2s + 1s pattern on first load. */
  useEffect(() => {
    scheduleReveal();
    return () => clearIdleTimer();
  }, [scheduleReveal, clearIdleTimer]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
    };
  }, []);

  const handleCopyClick = useCallback(async () => {
    try {
      const ok = await onCopyDocument();
      if (!ok) return;
      setCopySuccess(true);
      if (copyResetTimerRef.current !== null) clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = setTimeout(() => {
        copyResetTimerRef.current = null;
        setCopySuccess(false);
      }, COPY_SUCCESS_MS);
    } catch {
      setCopySuccess(false);
    }
  }, [onCopyDocument]);

  const visibleInSyncedMode = syncWithChrome ? !chromeHidden : showControls;

  return (
    <div
      className={`absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 transition-[opacity,transform] ease-out sm:bottom-10 ${
        visibleInSyncedMode
          ? `pointer-events-auto translate-y-0 opacity-100 ${syncWithChrome ? "duration-500 ease-in-out" : "duration-[1000ms]"}`
          : `pointer-events-none translate-y-[6px] opacity-0 ${syncWithChrome ? "duration-500 ease-in-out" : "duration-0"}`
      }`}
    >
      <div
        role="toolbar"
        aria-label="Ambient editor controls"
        className={`pointer-events-auto flex items-center justify-center gap-8 transition-colors duration-500 ease-in-out sm:gap-10 ${PILL_SURFACE}`}
      >
        <button
          type="button"
          className={ICON_BTN}
          aria-label="Toggle sidebars"
          title="Toggle sidebars"
          onClick={onToggleBothSidebars}
        >
          <SidebarLayoutIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </button>
        <button type="button" className={ICON_BTN} aria-label="Focus timer" onClick={() => undefined}>
          <Clock size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <button
          type="button"
          className={`${ICON_BTN} ${copySuccess ? "opacity-100" : ""}`}
          aria-label={copySuccess ? "Copied" : "Copy document"}
          title={copySuccess ? "Copied" : "Copy document"}
          onClick={() => void handleCopyClick()}
        >
          {copySuccess ? (
            <Check size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
          ) : (
            <Copy size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
