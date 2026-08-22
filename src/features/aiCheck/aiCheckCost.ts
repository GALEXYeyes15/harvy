import type { AiProvider } from "./aiCheck";

/** Dollars per 1M tokens (input / output). Approximate public list prices. */
type ModelRates = { inputPerMillion: number; outputPerMillion: number };

const DEFAULT_RATES: ModelRates = { inputPerMillion: 3, outputPerMillion: 15 };

/**
 * Rough pricing by model family. Not billing-accurate — for UI estimates only.
 * Prefer matching more specific prefixes first.
 */
const RATE_TABLE: Array<{ match: RegExp; rates: ModelRates }> = [
  { match: /^gpt-4o-mini/i, rates: { inputPerMillion: 0.15, outputPerMillion: 0.6 } },
  { match: /^gpt-4\.1-mini/i, rates: { inputPerMillion: 0.4, outputPerMillion: 1.6 } },
  { match: /^gpt-4\.1-nano/i, rates: { inputPerMillion: 0.1, outputPerMillion: 0.4 } },
  { match: /^gpt-4o/i, rates: { inputPerMillion: 2.5, outputPerMillion: 10 } },
  { match: /^gpt-4\.1/i, rates: { inputPerMillion: 2, outputPerMillion: 8 } },
  { match: /^o3-mini/i, rates: { inputPerMillion: 1.1, outputPerMillion: 4.4 } },
  { match: /^o1-mini/i, rates: { inputPerMillion: 1.1, outputPerMillion: 4.4 } },
  { match: /^o3/i, rates: { inputPerMillion: 2, outputPerMillion: 8 } },
  { match: /^o1/i, rates: { inputPerMillion: 15, outputPerMillion: 60 } },
  { match: /haiku/i, rates: { inputPerMillion: 0.8, outputPerMillion: 4 } },
  { match: /opus/i, rates: { inputPerMillion: 15, outputPerMillion: 75 } },
  { match: /sonnet/i, rates: { inputPerMillion: 3, outputPerMillion: 15 } },
  { match: /^claude/i, rates: { inputPerMillion: 3, outputPerMillion: 15 } },
  { match: /^gpt/i, rates: { inputPerMillion: 2.5, outputPerMillion: 10 } },
];

export function ratesForModel(modelId: string): ModelRates {
  const id = modelId.trim();
  for (const row of RATE_TABLE) {
    if (row.match.test(id)) return row.rates;
  }
  return DEFAULT_RATES;
}

/** ~4 characters per token is a common English approximation. */
export function estimateTokensFromText(text: string): number {
  const chars = text.trim().length;
  if (chars <= 0) return 0;
  return Math.max(1, Math.ceil(chars / 4));
}

export function estimateCostUsd(opts: {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const rates = ratesForModel(opts.modelId);
  return (
    (opts.inputTokens / 1_000_000) * rates.inputPerMillion +
    (opts.outputTokens / 1_000_000) * rates.outputPerMillion
  );
}

/** Typical JSON issue list size for a finished essay check. */
const TYPICAL_OUTPUT_TOKENS = 800;

/** System prompt + user framing overhead (chars), not including the essay body. */
const PROMPT_OVERHEAD_CHARS = 900;

/**
 * Pre-run estimate from essay length (no API usage yet).
 * Word count alone underestimates tokens; characters÷4 is closer.
 */
export function estimateAiCheckCostFromEssay(modelId: string, essay: string): number {
  const inputTokens = estimateTokensFromText(essay) + estimateTokensFromText("x".repeat(PROMPT_OVERHEAD_CHARS));
  return estimateCostUsd({
    modelId,
    inputTokens,
    outputTokens: TYPICAL_OUTPUT_TOKENS,
  });
}

export function formatAiCheckCostUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "< $0.01";
  if (usd < 0.01) return "< $0.01";
  if (usd < 1) return `~$${usd.toFixed(2)}`;
  return `~$${usd.toFixed(2)}`;
}

/**
 * `claude-fable-5` → `Claude Fable 5`
 * `claude-sonnet-4-20250514` → `Claude Sonnet 4`
 */
export function formatAiModelDisplayName(
  modelId: string,
  _provider?: AiProvider | null,
): string {
  const cleaned = modelId
    .trim()
    .replace(/-\d{8}$/i, "")
    .replace(/^chatgpt-/i, "chatgpt-");
  if (!cleaned) return "Unknown model";

  return cleaned
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "gpt") return "GPT";
      if (lower === "chatgpt") return "ChatGPT";
      if (/^o\d/i.test(part)) return part.toUpperCase();
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}
