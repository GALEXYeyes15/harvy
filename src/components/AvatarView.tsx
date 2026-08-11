import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import {
  readCollectAvatarText,
  writeCollectAvatarText,
} from "../features/collect/collectAvatar";

const COPY_BUTTON =
  "absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 opacity-0 transition-[opacity,background-color,color] hover:bg-ink/[0.08] hover:text-ink disabled:pointer-events-none disabled:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 dark:text-white/45 dark:hover:bg-white/[0.1] dark:hover:text-white";

export function AvatarView() {
  const [text, setText] = useState(() => readCollectAvatarText());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    writeCollectAvatarText(text);
  }, [text]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  return (
    <div className="group relative mt-7 flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        className={COPY_BUTTON}
        aria-label={copied ? "Copied" : "Copy avatar description"}
        title={copied ? "Copied" : "Copy"}
        disabled={!text.trim()}
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <Check size={15} strokeWidth={2} aria-hidden />
        ) : (
          <Copy size={15} strokeWidth={1.75} aria-hidden />
        )}
      </button>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Describe the audience you’re writing for…"
        spellCheck
        className="min-h-[16rem] w-full flex-1 resize-none overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-mist px-4 py-3.5 pr-12 text-[15px] leading-relaxed text-ink outline-none ring-1 ring-line/15 placeholder:text-ink/40 focus:ring-[var(--color-focus-ring)]/45 dark:ring-white/[0.06] dark:placeholder:text-white/35"
        aria-label="Avatar — target audience description"
      />
    </div>
  );
}
