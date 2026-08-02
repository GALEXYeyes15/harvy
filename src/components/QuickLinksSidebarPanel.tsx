import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { openSafeExternalUrl } from "../features/editor/openExternalUrl";
import type { QuickLink } from "../features/quick-links/quickLinks";
import {
  loadPersistedQuickLinks,
  QUICK_LINKS_CHANGED_EVENT,
  savePersistedQuickLinks,
} from "../features/quick-links/quickLinksPersistence";

function sameQuickLinks(a: QuickLink[], b: QuickLink[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function QuickLinksSidebarPanel() {
  const [links, setLinks] = useState<QuickLink[]>(() => loadPersistedQuickLinks());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    savePersistedQuickLinks(links);
  }, [links]);

  useEffect(() => {
    const sync = () => {
      const next = loadPersistedQuickLinks();
      setLinks((prev) => (sameQuickLinks(prev, next) ? prev : next));
    };
    window.addEventListener(QUICK_LINKS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(QUICK_LINKS_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  async function handleCopy(link: QuickLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  return (
    <section className="flex min-h-0 flex-col" aria-label="Quick Links">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted/70">
        Quick Links
      </h3>

      {links.length === 0 ? (
        <p className="mt-3 text-[12px] leading-snug text-muted/60">
          Add links in Settings → Quick Links.
        </p>
      ) : (
        <div className="mt-3 max-h-44 min-h-0 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <tbody>
              {links.map((link) => {
                const justCopied = copiedId === link.id;
                return (
                  <tr
                    key={link.id}
                    className="group border-b border-line/12 last:border-b-0 dark:border-white/[0.05]"
                  >
                    <td className="w-7 py-2 pr-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCopy(link)}
                        className={`flex h-6 w-6 items-center justify-center rounded-md transition-opacity hover:bg-ink/[0.06] ${
                          justCopied
                            ? "text-accent opacity-100"
                            : "text-muted/55 opacity-0 group-hover:opacity-100 hover:text-ink"
                        }`}
                        aria-label={justCopied ? `Copied ${link.title}` : `Copy ${link.title} link`}
                        title={justCopied ? "Copied" : "Copy link"}
                      >
                        {justCopied ? (
                          <Check size={12} strokeWidth={1.75} aria-hidden />
                        ) : (
                          <Copy size={12} strokeWidth={1.75} aria-hidden />
                        )}
                      </button>
                    </td>
                    <td className="max-w-0 py-2">
                      <button
                        type="button"
                        onClick={() => openSafeExternalUrl(link.url)}
                        className="block w-full truncate text-left text-[13px] text-ink transition-colors hover:text-accent"
                        title={link.url}
                      >
                        {link.title}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
