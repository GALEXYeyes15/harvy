const STORAGE_KEY = "harvy:headline-style-prompt";

export const DEFAULT_HEADLINE_STYLE_PROMPT = `You write titles and subtitles (deks) for essays.
Read the essay and propose exactly 5 distinct title+subtitle pairs.
Rules:
- Title is the headline; subtitle sits under it as the dek.
- Stay faithful to the essay; do not invent facts, names, or claims.
- Make the five pairs meaningfully different from each other.
- Titles: about 4–12 words. Subtitles: one sentence.
- No wrapping quotation marks around the whole title or subtitle.`;

export function readHeadlineStylePrompt(): string {
  if (typeof window === "undefined") return DEFAULT_HEADLINE_STYLE_PROMPT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_HEADLINE_STYLE_PROMPT;
    return raw;
  } catch {
    return DEFAULT_HEADLINE_STYLE_PROMPT;
  }
}

export function writeHeadlineStylePrompt(prompt: string): string {
  const next = prompt;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore quota / private-mode failures; in-memory value still applies this session.
    }
  }
  return next;
}

export function resetHeadlineStylePrompt(): string {
  return writeHeadlineStylePrompt(DEFAULT_HEADLINE_STYLE_PROMPT);
}
