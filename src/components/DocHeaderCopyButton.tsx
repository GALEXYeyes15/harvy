import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Hover-revealed copy button for the post Title / Subtitle fields.
 * Sits as a small opaque chip over the field's top-left corner.
 * The parent must be `relative` and carry the `harvy-doc-field` class (hover/focus reveal).
 * Hidden while the field is empty, and while typing in it until the pointer moves again.
 */
export function DocHeaderCopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [typing, setTyping] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const field = buttonRef.current?.parentElement;
    if (!field) return;
    const startTyping = () => setTyping(true);
    const stopTyping = () => setTyping(false);
    // `input` bubbles up from the field's textarea; any pointer motion brings the button back.
    field.addEventListener("input", startTyping);
    field.addEventListener("pointermove", stopTyping);
    return () => {
      field.removeEventListener("input", startTyping);
      field.removeEventListener("pointermove", stopTyping);
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const empty = !text.trim();

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`harvy-doc-copy${typing ? " harvy-doc-copy--typing" : ""}`}
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      title={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
      disabled={empty}
      // Keep focus (and the caret) in the field when clicking the button.
      onMouseDown={(event) => event.preventDefault()}
      onClick={async () => {
        if (empty) return;
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Clipboard may be unavailable; ignore.
        }
      }}
    >
      {copied ? (
        <Check size={17} strokeWidth={2} aria-hidden />
      ) : (
        <Copy size={17} strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}
