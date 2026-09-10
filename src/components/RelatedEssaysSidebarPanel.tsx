import { Zap } from "lucide-react";
import { useEffect, useState } from "react";
import {
  gatherRelatedEssayCandidates,
  rankRelatedEssays,
  type RelatedEssayItem,
} from "../features/related-essays/relatedEssays";
import type { FileNode } from "../features/workspace/types";

type RelatedEssaysSidebarPanelProps = {
  sourcePath: string;
  currentTitle: string;
  currentExcerpt: string;
  workspaceTree: FileNode | null;
  aiReady: boolean;
  onRelatedItemsFound?: (items: RelatedEssayItem[]) => Promise<string | null>;
};

export function RelatedEssaysSidebarPanel({
  sourcePath,
  currentTitle,
  currentExcerpt,
  workspaceTree,
  aiReady,
  onRelatedItemsFound,
}: RelatedEssaysSidebarPanelProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [sourcePath]);

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
        await onRelatedItemsFound?.([]);
        setError("No other essays in this workspace.");
        return;
      }
      const next = await rankRelatedEssays({
        title: currentTitle,
        excerpt: currentExcerpt,
        candidates,
      });
      const applyError = await onRelatedItemsFound?.(next);
      if (applyError) {
        setError(applyError);
        return;
      }
      if (next.length === 0) {
        setError("No related essays found.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-col space-y-2.5" aria-label="Related essays">
      <button
        type="button"
        onClick={() => void handleFind()}
        disabled={running}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-ink bg-transparent px-3 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-ink/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Zap size={14} strokeWidth={2} aria-hidden className="shrink-0" />
        <span>{running ? "Finding..." : "Find Related Essays"}</span>
      </button>
      {error ? (
        <p className="text-[12px] leading-snug text-muted/70">{error}</p>
      ) : null}
    </section>
  );
}
