import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

export const FOCUS_MODE_DURATION_MS = 25 * 60 * 1000;

type FocusModeModalProps = {
  open: boolean;
  onClose: () => void;
  /** When set, session is running — show remaining time and End. */
  endsAt: number | null;
  onStart: () => void;
  onEnd: () => void;
  /** Live remaining label while active (e.g. "24:32"). */
  remainingLabel?: string;
};

export function FocusModeModal({
  open,
  onClose,
  endsAt,
  onStart,
  onEnd,
  remainingLabel,
}: FocusModeModalProps) {
  const active = endsAt != null;

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title="Focus mode"
      titleId="focus-mode-dialog-title"
      backdropLabel="Dismiss focus mode"
      closeLabel="Close focus mode"
      maxWidthClass="max-w-[min(420px,calc(100vw-3rem))]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1"
    >
      {active ? (
        <div className="space-y-5">
          <p className="text-[13px] leading-relaxed text-muted/90">
            Sidebars stay closed and Backspace and arrow keys are disabled until the timer ends.
          </p>
          <div className="rounded-lg bg-mist/90 px-3.5 py-3 dark:bg-ink/[0.04]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
              Time remaining
            </p>
            <p className="mt-1 font-mono text-[22px] font-medium tracking-tight text-ink tabular-nums">
              {remainingLabel ?? "—"}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-[12px] font-medium text-muted/80 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              Keep going
            </button>
            <button
              type="button"
              onClick={() => {
                onEnd();
                onClose();
              }}
              className="rounded-md bg-ink px-3.5 py-2 text-[12px] font-medium text-page transition-opacity hover:opacity-90"
            >
              End focus
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[13px] leading-relaxed text-muted/90">
            A 25-minute writing sprint. Harvy goes fullscreen and stays frontmost. Sidebars stay
            closed, and Backspace and arrow keys are turned off so you keep moving forward.
          </p>
          <ul className="space-y-2 text-[12px] leading-snug text-muted/80">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden />
              <span>Fullscreen lock — Harvy stays on top for the session</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden />
              <span>Sidebars stay inactive for 25 minutes</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden />
              <span>Backspace and arrow keys are disabled in the editor</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden />
              <span>Press Esc anytime to end Focus mode</span>
            </li>
          </ul>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-[12px] font-medium text-muted/80 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onStart();
                onClose();
              }}
              className="rounded-md bg-ink px-3.5 py-2 text-[12px] font-medium text-page transition-opacity hover:opacity-90"
            >
              Start
            </button>
          </div>
        </div>
      )}
    </CenteredOverlayModal>
  );
}

export function formatFocusRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
