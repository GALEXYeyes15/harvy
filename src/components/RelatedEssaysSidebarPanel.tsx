import { Check, Copy, Link } from "lucide-react";
import { useEffect, useState } from "react";
import { openSafeExternalUrl } from "../features/editor/openExternalUrl";
import {
  gatherRelatedEssayCandidates,
  loadRelatedEssayItems,
  preferredRelatedUrl,
  rankRelatedEssays,
  saveRelatedEssayItems,
  type RelatedEssayItem,
} from "../features/related-essays/relatedEssays";
import type { FileNode } from "../features/workspace/types";

type RelatedEssaysSidebarPanelProps = {
  sourcePath: string;
  currentTitle: string;
  currentExcerpt: string;
  workspaceTree: FileNode | null;
  aiReady: boolean;
  onOpenFile?: (path: string) => void;
};

export function RelatedEssaysSidebarPanel({
  sourcePath,
  currentTitle,
  currentExcerpt,
  workspaceTree,
  aiReady,
  onOpenFile,
}: RelatedEssaysSidebarPanelProps) {
  const [items, setItems] = useState<RelatedEssayItem[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!sourcePath.trim()) {
      setItems([]);
      return;
    }
    void loadRelatedEssayItems(sourcePath).then((next) => {
      if (!cancelled) setItems(next);
    });
    return () => {
      cancelled = true;
    };
  }, [sourcePath]);

  useEffect(() => {
    if (!copiedPath) return;
    const timer = window.setTimeout(() => setCopiedPath(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedPath]);

  async function handleFind() {
    if (!sourcePath.trim()) {
      setError("Save this essay first.");
      return;
    }
    if (!aiReady) {
      setError("Connect AI in Settings → Sidebars first.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const candidates = await gatherRelatedEssayCandidates({
        tree: workspaceTree,
        currentPath: sourcePath,
      });
      if (candidates.length === 0) {
        setItems([]);
        await saveRelatedEssayItems(sourcePath, []);
        setError("No other essays in this workspace.");
        return;
      }
      const next = await rankRelatedEssays({
        title: currentTitle,
        excerpt: currentExcerpt,
        candidates,
      });
      setItems(next);
      await saveRelatedEssayItems(sourcePath, next);
      if (next.length === 0) {
        setError("No related essays found.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function handleCopy(item: RelatedEssayItem) {
    const url = preferredRelatedUrl(item);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPath(item.path || item.title);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  function handleOpen(item: RelatedEssayItem) {
    const url = preferredRelatedUrl(item);
    if (url) {
      openSafeExternalUrl(url);
      return;
    }
    if (item.path) onOpenFile?.(item.path);
  }

  return (
    <section className="flex min-h-0 flex-col" aria-label="Related essays">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted/70">
        Related essays
      </h3>
      <button
        type="button"
        onClick={() => void handleFind()}
        disabled={running}
        className="mt-3 self-start rounded-md px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line/15 transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "Finding…" : "Find related essays"}
      </button>
      {error ? (
        <p className="mt-3 text-[12px] leading-snug text-muted/70">{error}</p>
      ) : null}
      {items.length > 0 ? (
        <div className="mt-3 max-h-44 min-h-0 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <tbody>
              {items.map((item) => {
                const url = preferredRelatedUrl(item);
                const copyKey = item.path || item.title;
                const justCopied = copiedPath === copyKey;
                return (
                  <tr
                    key={copyKey}
                    className="group border-b border-line/12 last:border-b-0 dark:border-white/[0.05]"
                  >
                    <td className="w-7 py-2 pr-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCopy(item)}
                        disabled={!url}
                        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-ink/[0.06] disabled:cursor-default disabled:opacity-35 ${
                          justCopied ? "text-accent" : "text-muted/55 hover:text-ink"
                        }`}
                        aria-label={
                          url
                            ? justCopied
                              ? `Copied ${item.title}`
                              : `Copy ${item.title} link`
                            : "Sync to get a link"
                        }
                        title={url ? (justCopied ? "Copied" : "Copy link") : "Sync to get a link"}
                      >
                        {justCopied ? (
                          <Check size={12} strokeWidth={1.75} aria-hidden />
                        ) : (
                          <>
                            <Link
                              size={12}
                              strokeWidth={1.75}
                              aria-hidden
                              className="group-hover:hidden"
                            />
                            <Copy
                              size={12}
                              strokeWidth={1.75}
                              aria-hidden
                              className="hidden group-hover:block"
                            />
                          </>
                        )}
                      </button>
                    </td>
                    <td className="max-w-0 py-2">
                      <button
                        type="button"
                        onClick={() => handleOpen(item)}
                        className="block w-full truncate text-left text-[13px] text-ink transition-colors hover:text-accent"
                        title={item.why || url || item.path}
                      >
                        {item.title}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
