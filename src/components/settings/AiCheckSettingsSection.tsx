import { useEffect, useState } from "react";
import { isTauriRuntime } from "../../features/save/saveRuntime";
import {
  clearAiCheckConfig,
  getAiCheckConfig,
  listAiModels,
  providerLabel,
  saveAiCheckConfig,
  testAiCheckConnection,
  type AiCheckConfigPublic,
  type AiModelInfo,
  type AiProvider,
} from "../../features/aiCheck/aiCheck";

const BOX = "rounded-xl bg-mist px-3.5 py-3";
const FIELD =
  "w-full rounded-md border-0 bg-page px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/15 focus:ring-[var(--color-focus-ring)]/45";
const BUTTON =
  "rounded-md bg-page px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line/15 transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  /** Called whenever stored enabled/connected state changes so the toggle stays in sync. */
  onConfigChange?: (config: AiCheckConfigPublic) => void;
};

export function AiCheckSettingsSection({ onConfigChange }: Props) {
  const tauri = isTauriRuntime();
  const [config, setConfig] = useState<AiCheckConfigPublic | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [detectedProvider, setDetectedProvider] = useState<AiProvider | null>(null);
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
    if (!tauri) return;
    void (async () => {
      try {
        const next = await getAiCheckConfig();
        applyConfig(next);
        if (next.hasApiKey) {
          try {
            const listed = await listAiModels();
            setModels(listed);
            if (!next.model && listed[0]) {
              setModel(listed[0].id);
            }
          } catch {
            // Key may be invalid; user can re-save.
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauri]);

  if (!tauri) {
    return (
      <div className={BOX}>
        <p className="text-[13px] font-medium text-ink">AI check</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
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
      // First-time connect turns AI check on so API settings stay visible after save.
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
        chosen = listed[0]?.id ?? "";
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
          ? `Detected ${providerLabel(next.provider)} — ${listed.length} model${listed.length === 1 ? "" : "s"} available.`
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
      setMessage(`Model set to ${nextModel}.`);
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
      const msg = await testAiCheckConnection({
        apiKey: apiKey.trim() || undefined,
        model: model || undefined,
      });
      setMessage(msg);
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
      const next = await clearAiCheckConfig();
      applyConfig(next);
      setApiKey("");
      setModel("");
      setModels([]);
      setDetectedProvider(null);
      setMessage("AI check disconnected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const provider = detectedProvider ?? config?.provider ?? null;

  return (
    <div className={`space-y-3 ${BOX}`}>
      <div>
        <p className="text-[13px] font-medium text-ink">API & model</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
          Paste an OpenAI (<span className="font-mono text-[10px]">sk-…</span>) or Anthropic (
          <span className="font-mono text-[10px]">sk-ant-…</span>) key. Harvy detects the provider and
          lists chat models you can test.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
          API key
        </span>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config?.hasApiKey ? "••••••••  (leave blank to keep)" : "sk-… or sk-ant-…"}
          className={FIELD}
        />
      </label>

      {provider ? (
        <p className="text-[12px] text-muted/80">
          Provider: <span className="font-medium text-ink">{providerLabel(provider)}</span>
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
          Model
        </span>
        {models.length > 0 ? (
          <select
            value={model}
            onChange={(e) => void handleModelChange(e.target.value)}
            className={FIELD}
            disabled={busy}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Save key to load models"
            className={FIELD}
            disabled={!config?.hasApiKey && !apiKey.trim()}
          />
        )}
      </label>

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
          <>
            <button
              type="button"
              className={BUTTON}
              disabled={busy || !model}
              onClick={() => void handleTest()}
            >
              Test model
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
  );
}
