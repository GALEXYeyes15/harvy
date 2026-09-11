import { ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatModelIdForPicker,
  modelOptionLabel,
  pickRecommendedModelId,
  sortModelsByCost,
} from "../../features/aiCheck/aiCheckCost";
import { isTauriRuntime } from "../../features/save/saveRuntime";
import {
  clearAiCheckConfig,
  getAiCheckConfig,
  listAiModels,
  providerLabel,
  saveAiCheckConfig,
  type AiCheckConfigPublic,
  type AiModelInfo,
  type AiProvider,
} from "../../features/aiCheck/aiCheck";

const BOX = "rounded-xl bg-mist px-3.5 py-3";
const FIELD_BOX = "overflow-hidden rounded-lg bg-page/70";
const FIELD =
  "w-full rounded-md border-0 bg-page px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/15 focus:ring-[var(--color-focus-ring)]/45";
const FIELD_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/55";
const BUTTON =
  "rounded-md bg-page px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line/15 transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  /** Called whenever stored enabled/connected state changes so the toggle stays in sync. */
  onConfigChange?: (config: AiCheckConfigPublic) => void;
  /** When true, omit the mist box (for nesting inside an expandable settings group). */
  embedded?: boolean;
  /** Preloaded config from parent — renders immediately without a config refetch. */
  initialConfig?: AiCheckConfigPublic | null;
};

export function AiCheckSettingsSection({
  onConfigChange,
  embedded = false,
  initialConfig = null,
}: Props) {
  const tauri = isTauriRuntime();
  const [config, setConfig] = useState<AiCheckConfigPublic | null>(initialConfig);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(() => initialConfig?.model ?? "");
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [detectedProvider, setDetectedProvider] = useState<AiProvider | null>(
    () => initialConfig?.provider ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyConfig = (next: AiCheckConfigPublic) => {
    setConfig(next);
    setModel(next.model);
    setDetectedProvider(next.provider);
    onConfigChange?.(next);
  };

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setModel(initialConfig.model);
      setDetectedProvider(initialConfig.provider);
    }
  }, [initialConfig]);

  useEffect(() => {
    if (!tauri || embedded) return;
    void getAiCheckConfig()
      .then(applyConfig)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauri, embedded]);

  useEffect(() => {
    if (!tauri || !config?.hasApiKey || models.length > 0) return;
    let cancelled = false;
    void listAiModels()
      .then((listed) => {
        if (cancelled) return;
        setModels(listed);
        if (!config.model && listed.length > 0) {
          setModel(pickRecommendedModelId(listed, config.provider) ?? listed[0]!.id);
        }
      })
      .catch(() => {
        // Key may be invalid; user can re-save.
      });
    return () => {
      cancelled = true;
    };
  }, [tauri, config?.hasApiKey, config?.model, config?.provider, models.length]);

  const shellClass = embedded ? "space-y-3" : `space-y-3 ${BOX}`;

  if (!tauri) {
    return (
      <div className={shellClass}>
        {embedded ? null : <p className="text-[13px] font-medium text-ink">AI check</p>}
        <p className={`${embedded ? "" : "mt-0.5 "}text-[12px] leading-snug text-muted/75`}>
          Add an OpenAI or Anthropic API key in the Harvy desktop app to enable on-demand essay
          review.
        </p>
      </div>
    );
  }

  const handleSaveAndDetect = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const keepExistingKey = Boolean(config?.hasApiKey && !apiKey.trim());
      const enabled = config?.hasApiKey ? Boolean(config.enabled) : true;
      const next = await saveAiCheckConfig({
        apiKey,
        model: model || undefined,
        enabled,
        keepExistingKey,
      });
      applyConfig(next);
      setApiKey("");

      const listed = await listAiModels();
      setModels(listed);

      let chosen = next.model;
      if (!chosen || !listed.some((m) => m.id === chosen)) {
        chosen = pickRecommendedModelId(listed, next.provider) ?? listed[0]?.id ?? "";
      }
      setModel(chosen);

      if (chosen && chosen !== next.model) {
        const updated = await saveAiCheckConfig({
          apiKey: "",
          model: chosen,
          enabled: next.enabled,
          keepExistingKey: true,
        });
        applyConfig(updated);
      }

      setMessage(
        next.provider
          ? `${providerLabel(next.provider)} connected — ${listed.length} model${listed.length === 1 ? "" : "s"}.`
          : "API key saved.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleModelChange = async (nextModel: string) => {
    setModel(nextModel);
    if (!config?.hasApiKey) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await saveAiCheckConfig({
        apiKey: "",
        model: nextModel,
        enabled: config.enabled,
        keepExistingKey: true,
      });
      applyConfig(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveApi = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await clearAiCheckConfig();
      applyConfig(next);
      setApiKey("");
      setModel("");
      setModels([]);
      setDetectedProvider(null);
      setMessage("API key removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const provider = detectedProvider ?? config?.provider ?? null;
  const modelOptions = sortModelsByCost(
    models.length > 0
      ? models
      : model
        ? [{ id: model, provider: provider ?? "openai" }]
        : [],
  );
  const providerText = provider ? providerLabel(provider) : "Not connected";
  const selectedModelLabel = model ? formatModelIdForPicker(model) : "Default";

  return (
    <div className={shellClass}>
      <ul className={FIELD_BOX}>
        <li className="px-3.5 py-3">
          <label className="block space-y-1.5">
            <span className={FIELD_LABEL}>API key</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.hasApiKey ? "••••••••  (leave blank to keep)" : "sk-… or sk-ant-…"}
              className={FIELD}
            />
          </label>
        </li>

        <li className="flex items-center justify-between gap-4 px-3.5 pb-3 pt-0">
          <span className="shrink-0 text-[13px] text-ink">
            Provider{provider ? `: ${providerText}` : ""}
          </span>
          <div className="flex min-w-0 items-center justify-end gap-1">
            {modelOptions.length > 0 ? (
              <>
                <div className="relative max-w-[min(100%,14rem)]">
                  <span
                    className="block truncate text-right text-[13px] text-ink"
                    aria-hidden
                  >
                    {selectedModelLabel}
                  </span>
                  <select
                    value={model}
                    onChange={(e) => void handleModelChange(e.target.value)}
                    aria-label="AI model"
                    className="absolute inset-0 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    disabled={busy || !config?.hasApiKey}
                  >
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {modelOptionLabel(m.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <ChevronsUpDown
                  size={13}
                  strokeWidth={2}
                  className="shrink-0 text-muted/55"
                  aria-hidden
                />
              </>
            ) : (
              <>
                <span className="text-[13px] text-muted/55">Default</span>
                <ChevronsUpDown
                  size={13}
                  strokeWidth={2}
                  className="shrink-0 text-muted/55"
                  aria-hidden
                />
              </>
            )}
          </div>
        </li>
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={busy || (!apiKey.trim() && !config?.hasApiKey)}
          onClick={() => void handleSaveAndDetect()}
        >
          Save & detect models
        </button>
        {config?.hasApiKey ? (
          <button
            type="button"
            className={BUTTON}
            disabled={busy}
            onClick={() => void handleRemoveApi()}
          >
            Remove API
          </button>
        ) : null}
      </div>

      {message ? <p className="text-[12px] text-muted/80">{message}</p> : null}
      {error ? <p className="text-[12px] text-red-600/90 dark:text-red-400/90">{error}</p> : null}
    </div>
  );
}
