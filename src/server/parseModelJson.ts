const FENCED_JSON_BLOCK = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const FENCED_JSON_PREFIX = /^```(?:json)?\s*([\s\S]*)$/i;

function previewText(text: string, maxLen = 800): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}…`;
}

/** Collect likely JSON substrings from model text (raw, fenced, or outer `{…}`). */
export function extractJsonCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const candidates: string[] = [trimmed];

  const fullFence = trimmed.match(FENCED_JSON_BLOCK);
  if (fullFence?.[1]) {
    candidates.push(fullFence[1].trim());
  }

  const openFence = trimmed.match(FENCED_JSON_PREFIX);
  if (openFence?.[1]) {
    candidates.push(openFence[1].replace(/```\s*$/u, "").trim());
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }

  return [...new Set(candidates.filter(Boolean))];
}

export function parseModelJsonText(raw: string, context = "model"): unknown {
  const candidates = extractJsonCandidates(raw);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  console.error(`RAW ANTHROPIC RESPONSE (${context})`, raw);
  const detail = lastError?.message ? `: ${lastError.message}` : "";
  throw new Error(`Anthropic returned invalid JSON${detail} (preview: ${previewText(raw)})`);
}
