import { useEffect, useState } from "react";
import { isTauriRuntime } from "../../features/save/saveRuntime";
import {
  clearNotionIdeasConfig,
  dateOptionsFromSchema,
  fetchNotionDatabaseSchema,
  getNotionIdeasConfig,
  inferNotionIdeasPropertyMap,
  saveNotionIdeasConfig,
  statusOptionsFromSchema,
  testNotionIdeasConnection,
  urlOptionsFromSchema,
  type NotionIdeasConfigPublic,
  type NotionPropertyInfo,
} from "../../features/notion/notionIdeas";

const BOX = "rounded-xl bg-mist px-3.5 py-3";
const FIELD =
  "w-full rounded-md border-0 bg-page px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/15 focus:ring-[var(--color-focus-ring)]/45";
const BUTTON =
  "rounded-md bg-page px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line/15 transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

function optionsWithCurrent(options: string[], current: string): string[] {
  const trimmed = current.trim();
  if (!trimmed) return options;
  if (options.some((option) => option === trimmed)) return options;
  return [trimmed, ...options];
}

export function NotionIdeasSettingsSection() {
  const tauri = isTauriRuntime();
  const [config, setConfig] = useState<NotionIdeasConfigPublic | null>(null);
  const [token, setToken] = useState("");
  const [databaseIdOrUrl, setDatabaseIdOrUrl] = useState("");
  const [ideaStatusValue, setIdeaStatusValue] = useState("Idea");
  const [startedStatusValue, setStartedStatusValue] = useState("Started");
  const [publishedStatusValue, setPublishedStatusValue] = useState("Published");
  const [statusPropertyName, setStatusPropertyName] = useState("Status");
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [urlProperty, setUrlProperty] = useState("");
  const [urlOptions, setUrlOptions] = useState<string[]>([]);
  const [dateProperty, setDateProperty] = useState("");
  const [dateOptions, setDateOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applySchema = (
    schema: NotionPropertyInfo[],
    currentUrlProperty?: string,
    currentDateProperty?: string,
  ) => {
    const map = inferNotionIdeasPropertyMap(schema);
    if (map.statusProperty) setStatusPropertyName(map.statusProperty);
    setStatusOptions(statusOptionsFromSchema(schema));
    const urls = urlOptionsFromSchema(schema);
    setUrlOptions(urls);
    if (currentUrlProperty !== undefined) {
      setUrlProperty(currentUrlProperty.trim());
    } else if (urlProperty && urls.includes(urlProperty)) {
      // keep the current selection
    } else if (map.urlProperty) {
      setUrlProperty(map.urlProperty);
    }
    const dates = dateOptionsFromSchema(schema);
    setDateOptions(dates);
    if (currentDateProperty !== undefined) {
      setDateProperty(currentDateProperty.trim());
    } else if (dateProperty && dates.includes(dateProperty)) {
      // keep the current selection
    } else if (map.dateProperty) {
      setDateProperty(map.dateProperty);
    }
    return map;
  };

  useEffect(() => {
    if (!tauri) return;
    void (async () => {
      try {
        const next = await getNotionIdeasConfig();
        setConfig(next);
        setDatabaseIdOrUrl(next.databaseId);
        setIdeaStatusValue(next.ideaStatusValue || "Idea");
        setStartedStatusValue(next.startedStatusValue || "Started");
        setPublishedStatusValue(next.publishedStatusValue || "Published");
        if (next.statusProperty) setStatusPropertyName(next.statusProperty);
        if (next.urlProperty) setUrlProperty(next.urlProperty);
        if (next.dateProperty) setDateProperty(next.dateProperty);
        if (next.connected) {
          const schema = await fetchNotionDatabaseSchema({
            databaseIdOrUrl: next.databaseId || undefined,
          });
          applySchema(schema, next.urlProperty, next.dateProperty);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [tauri]);

  if (!tauri) {
    return (
      <div className={BOX}>
        <p className="text-[13px] font-medium text-ink">Notion Ideas</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted/75">
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
      const map = applySchema(schema, urlProperty, dateProperty);
      if (!map.titleProperty) {
        throw new Error("Could not find a Title property on that Notion database.");
      }
      if (!map.statusProperty) {
        throw new Error(
          "Could not find a Status or Progress property on that Notion database.",
        );
      }

      const next = await saveNotionIdeasConfig({
        token,
        databaseIdOrUrl,
        titleProperty: map.titleProperty,
        notesProperty: map.notesProperty,
        statusProperty: map.statusProperty,
        ideaStatusValue,
        startedStatusValue,
        publishedStatusValue,
        urlProperty,
        dateProperty,
        keepExistingToken: Boolean(config?.hasToken && !token.trim()),
      });
      setConfig(next);
      setToken("");
      setDatabaseIdOrUrl(next.databaseId);
      setIdeaStatusValue(next.ideaStatusValue || "Idea");
      setStartedStatusValue(next.startedStatusValue || "Started");
      setPublishedStatusValue(next.publishedStatusValue || "Published");
      if (next.statusProperty) setStatusPropertyName(next.statusProperty);
      setUrlProperty(next.urlProperty || "");
      setDateProperty(next.dateProperty || "");
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
      const schema = await fetchNotionDatabaseSchema({
        token: token.trim() || undefined,
        databaseIdOrUrl: databaseIdOrUrl.trim() || undefined,
      });
      const map = applySchema(schema);
      const savedId = (config?.databaseId || "").replace(/-/g, "").toLowerCase();
      const formId = databaseIdOrUrl.replace(/-/g, "").toLowerCase().replace(/[^a-f0-9]/g, "");
      const testingSavedDatabase = savedId.length === 32 && formId.endsWith(savedId);
      if (testingSavedDatabase) {
        const count = await testNotionIdeasConnection();
        const propertyLabel = map.statusProperty || statusPropertyName;
        setMessage(
          `Connected — ${count} page${count === 1 ? "" : "s"} with ${propertyLabel} “${ideaStatusValue || "Idea"}”.`,
        );
      } else {
        setMessage("That database is reachable. Save connection to use it in Ideas.");
      }
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
      setPublishedStatusValue("Published");
      setStatusPropertyName("Status");
      setStatusOptions([]);
      setUrlProperty("");
      setUrlOptions([]);
      setDateProperty("");
      setDateOptions([]);
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
        <p className="mt-0.5 text-[12px] leading-snug text-muted/75">
          Sync pulls Notion pages for the {statusPropertyName} below. Start writing updates{" "}
          {statusPropertyName} so they leave the queue. Title, Notes, and {statusPropertyName}{" "}
          columns are detected automatically from your database.
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
            Show when {statusPropertyName} is
          </span>
          <select
            value={ideaStatusValue}
            onChange={(e) => setIdeaStatusValue(e.target.value)}
            className={FIELD}
            aria-label={`Show when ${statusPropertyName} is`}
            disabled={busy}
          >
            {optionsWithCurrent(statusOptions, ideaStatusValue).length === 0 ? (
              <option value={ideaStatusValue || ""}>
                Save connection to load {statusPropertyName} options
              </option>
            ) : (
              optionsWithCurrent(statusOptions, ideaStatusValue).map((option) => (
                <option key={`idea-${option}`} value={option}>
                  {option}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
            Change {statusPropertyName} to when started
          </span>
          <select
            value={startedStatusValue}
            onChange={(e) => setStartedStatusValue(e.target.value)}
            className={FIELD}
            aria-label={`Change ${statusPropertyName} to when started`}
            disabled={busy}
          >
            {optionsWithCurrent(statusOptions, startedStatusValue).length === 0 ? (
              <option value={startedStatusValue || ""}>
                Save connection to load {statusPropertyName} options
              </option>
            ) : (
              optionsWithCurrent(statusOptions, startedStatusValue).map((option) => (
                <option key={`started-${option}`} value={option}>
                  {option}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
            Change {statusPropertyName} to when published
          </span>
          <select
            value={publishedStatusValue}
            onChange={(e) => setPublishedStatusValue(e.target.value)}
            className={FIELD}
            aria-label={`Change ${statusPropertyName} to when published`}
            disabled={busy}
          >
            {optionsWithCurrent(statusOptions, publishedStatusValue).length === 0 ? (
              <option value={publishedStatusValue || ""}>
                Save connection to load {statusPropertyName} options
              </option>
            ) : (
              optionsWithCurrent(statusOptions, publishedStatusValue).map((option) => (
                <option key={`published-${option}`} value={option}>
                  {option}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
            Published URL property
          </span>
          <select
            value={urlProperty}
            onChange={(e) => setUrlProperty(e.target.value)}
            className={FIELD}
            aria-label="Published URL property"
            disabled={busy}
          >
            <option value="">None — add a link on the page</option>
            {optionsWithCurrent(urlOptions, urlProperty)
              .filter(Boolean)
              .map((option) => (
                <option key={`url-${option}`} value={option}>
                  {option}
                </option>
              ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
            Publish date property
          </span>
          <select
            value={dateProperty}
            onChange={(e) => setDateProperty(e.target.value)}
            className={FIELD}
            aria-label="Publish date property"
            disabled={busy}
          >
            <option value="">None</option>
            {optionsWithCurrent(dateOptions, dateProperty)
              .filter(Boolean)
              .map((option) => (
                <option key={`date-${option}`} value={option}>
                  {option}
                </option>
              ))}
          </select>
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
