import { useEffect, useState } from "react";
import { isTauriRuntime } from "../../features/save/saveRuntime";
import {
  clearNotionIdeasConfig,
  fetchNotionDatabaseSchema,
  getNotionIdeasConfig,
  inferNotionIdeasPropertyMap,
  saveNotionIdeasConfig,
  testNotionIdeasConnection,
  type NotionIdeasConfigPublic,
} from "../../features/notion/notionIdeas";

const BOX = "rounded-xl bg-mist px-3.5 py-3";
const FIELD =
  "w-full rounded-md border-0 bg-page px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/15 focus:ring-[var(--color-focus-ring)]/45";
const BUTTON =
  "rounded-md bg-page px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line/15 transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

export function NotionIdeasSettingsSection() {
  const tauri = isTauriRuntime();
  const [config, setConfig] = useState<NotionIdeasConfigPublic | null>(null);
  const [token, setToken] = useState("");
  const [databaseIdOrUrl, setDatabaseIdOrUrl] = useState("");
  const [ideaStatusValue, setIdeaStatusValue] = useState("Idea");
  const [startedStatusValue, setStartedStatusValue] = useState("Started");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tauri) return;
    void (async () => {
      try {
        const next = await getNotionIdeasConfig();
        setConfig(next);
        setDatabaseIdOrUrl(next.databaseId);
        setIdeaStatusValue(next.ideaStatusValue || "Idea");
        setStartedStatusValue(next.startedStatusValue || "Started");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [tauri]);

  if (!tauri) {
    return (
      <div className={BOX}>
        <p className="text-[13px] font-medium text-ink">Notion Ideas</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
          Connect a Notion database in the Harvy desktop app to sync essay ideas.
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const schema = await fetchNotionDatabaseSchema({
        token: token.trim() || undefined,
        databaseIdOrUrl: databaseIdOrUrl.trim() || undefined,
      });
      const map = inferNotionIdeasPropertyMap(schema);
      if (!map.titleProperty) {
        throw new Error("Could not find a Title property on that Notion database.");
      }
      if (!map.statusProperty) {
        throw new Error("Could not find a Status (or Select) property on that Notion database.");
      }

      const next = await saveNotionIdeasConfig({
        token,
        databaseIdOrUrl,
        titleProperty: map.titleProperty,
        notesProperty: map.notesProperty,
        statusProperty: map.statusProperty,
        ideaStatusValue,
        startedStatusValue,
        keepExistingToken: Boolean(config?.hasToken && !token.trim()),
      });
      setConfig(next);
      setToken("");
      setDatabaseIdOrUrl(next.databaseId);
      setIdeaStatusValue(next.ideaStatusValue || "Idea");
      setStartedStatusValue(next.startedStatusValue || "Started");
      setMessage("Notion Ideas connected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const count = await testNotionIdeasConnection();
      setMessage(
        `Connected — ${count} page${count === 1 ? "" : "s"} with Status “${ideaStatusValue || "Idea"}”.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await clearNotionIdeasConfig();
      setConfig(null);
      setToken("");
      setDatabaseIdOrUrl("");
      setIdeaStatusValue("Idea");
      setStartedStatusValue("Started");
      setMessage("Disconnected Notion Ideas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className={BOX}>
        <p className="text-[13px] font-medium text-ink">Notion Ideas</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
          Sync pulls Notion pages for the Status below. Start writing updates Status so they leave
          the queue. Title, Notes, and Status columns are detected automatically from your database.
        </p>
      </div>

      <div className={`space-y-3 ${BOX}`}>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
            Integration secret
          </span>
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={config?.hasToken ? "••••••••  (leave blank to keep)" : "secret_…"}
            className={FIELD}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
            Database URL or ID
          </span>
          <input
            type="text"
            value={databaseIdOrUrl}
            onChange={(e) => setDatabaseIdOrUrl(e.target.value)}
            placeholder="https://www.notion.so/…"
            className={FIELD}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
            Show when Status is
          </span>
          <input
            type="text"
            value={ideaStatusValue}
            onChange={(e) => setIdeaStatusValue(e.target.value)}
            placeholder="Idea"
            className={FIELD}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
            Change Status to when started
          </span>
          <input
            type="text"
            value={startedStatusValue}
            onChange={(e) => setStartedStatusValue(e.target.value)}
            placeholder="Started"
            className={FIELD}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON} disabled={busy} onClick={() => void handleSave()}>
            Save connection
          </button>
          {config?.connected ? (
            <>
              <button
                type="button"
                className={BUTTON}
                disabled={busy}
                onClick={() => void handleTest()}
              >
                Test sync
              </button>
              <button
                type="button"
                className={BUTTON}
                disabled={busy}
                onClick={() => void handleDisconnect()}
              >
                Disconnect
              </button>
            </>
          ) : null}
        </div>

        {message ? <p className="text-[12px] text-muted/80">{message}</p> : null}
        {error ? <p className="text-[12px] text-red-600/90 dark:text-red-400/90">{error}</p> : null}
      </div>
    </div>
  );
}
