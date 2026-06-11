import { X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

function focusableSelector() {
  return 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
}

export type CenteredOverlayModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  backdropLabel: string;
  closeLabel: string;
  maxWidthClass?: string;
  /** Region below the header (scroll / layout). */
  bodyClassName?: string;
  /** When false, skip auto-focusing the close button (e.g. focus a field in the body instead). */
  autoFocusCloseButton?: boolean;
  /** Optional class for the header close control (e.g. square hit target). */
  closeButtonClassName?: string;
  /** When false, header shows title only (dismiss via footer / Escape / backdrop). */
  showHeaderClose?: boolean;
  /** Optional line shown under the title in the header. */
  subtitle?: ReactNode;
  zIndexClass?: string;
  children: ReactNode;
};

export function CenteredOverlayModal({
  open,
  onClose,
  title,
  titleId,
  backdropLabel,
  closeLabel,
  maxWidthClass = "max-w-[min(1120px,calc(100vw-3rem))]",
  bodyClassName = "min-h-0 flex-1 overflow-y-auto px-6 py-5",
  autoFocusCloseButton = true,
  closeButtonClassName,
  showHeaderClose = true,
  subtitle,
  zIndexClass = "z-[200]",
  children,
}: CenteredOverlayModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;

      const root = panelRef.current;
      const list = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector())).filter(
        (el) => !el.hasAttribute("data-focus-guard") && root.contains(el),
      );
      if (list.length === 0) return;

      const first = list[0]!;
      const last = list[list.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    if (autoFocusCloseButton && showHeaderClose) {
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, handleClose, autoFocusCloseButton, showHeaderClose]);

  if (!open) return null;

  return createPortal(
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-6`} role="presentation">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-ink/[0.22] backdrop-blur-[1px]"
        aria-label={backdropLabel}
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[min(82vh,calc(100vh-3rem))] w-full ${maxWidthClass} min-h-0 flex-col overflow-hidden rounded-xl bg-page shadow-[0_24px_64px_-20px_rgba(28,25,23,0.16)] dark:shadow-[0_28px_80px_-24px_rgba(0,0,0,0.55)]`}
      >
        <header
          className={
            showHeaderClose
              ? "flex shrink-0 items-center justify-between gap-4 px-6 py-3.5"
              : "flex shrink-0 items-center px-6 py-3.5"
          }
        >
          <div className="min-w-0">
            <h1 id={titleId} className="text-[15px] font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-[12px] font-normal text-muted/65 dark:text-white/45">{subtitle}</p>
            ) : null}
          </div>
          {showHeaderClose ? (
            <button
              ref={closeButtonRef}
              type="button"
              aria-label={closeLabel}
              className={
                closeButtonClassName ??
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
              }
              onClick={handleClose}
            >
              <X size={18} strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}
        </header>
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
