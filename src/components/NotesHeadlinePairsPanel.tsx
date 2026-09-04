import { Zap } from "lucide-react";
import type { HeadlinePair } from "../features/aiCheck/aiCheck";

type NotesHeadlinePairsPanelProps = {
  enabled: boolean;
  running: boolean;
  error: string | null;
  pairs: HeadlinePair[];
  selectedIndex: number | null;
  onGenerate: () => void | Promise<void>;
  onSelectPair: (pair: HeadlinePair, index: number) => void;
};

export function NotesHeadlinePairsPanel({
  enabled,
  running,
  error,
  pairs,
  selectedIndex,
  onGenerate,
  onSelectPair,
}: NotesHeadlinePairsPanelProps) {
  return (
    <section className="flex min-h-0 flex-col" aria-label="Headlines">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted/70">
        Headlines
      </h3>

      <button
        type="button"
        disabled={running || !enabled}
        onClick={() => {
          if (!enabled || running) return;
          void onGenerate();
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-ink bg-transparent px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-ink/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Zap size={14} strokeWidth={2} aria-hidden className="shrink-0" />
        <span>{running ? "Suggesting..." : "Suggest titles"}</span>
      </button>

      {!enabled ? (
        <p className="mt-3 text-[12px] leading-snug text-muted/60">
          Enable AI check and add an API key in Settings → Sidebars first.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-[12px] leading-snug text-red-600/90 dark:text-red-400/90">{error}</p>
      ) : null}

      {pairs.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {pairs.map((pair, index) => {
            const selected = selectedIndex === index;
            return (
              <li key={`${index}-${pair.title}`}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectPair(pair, index)}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition-colors ${
                    selected
                      ? "bg-accent/12 ring-1 ring-accent/40"
                      : "hover:bg-ink/[0.05]"
                  }`}
                >
                  <span className="block text-[13px] font-medium leading-snug text-ink">
                    {pair.title}
                  </span>
                  {pair.subtitle ? (
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted/70">
                      {pair.subtitle}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
