export type EncouragementPhrase = {
  id: string;
  text: string;
  author: string;
};

export type EncouragementPrefs = {
  enabled: boolean;
  /** Inclusive lower bound for random interval (minutes). */
  minMinutes: number;
  /** Inclusive upper bound for random interval (minutes). */
  maxMinutes: number;
  phrases: EncouragementPhrase[];
};

const STORAGE_KEY = "harvy:encouragement";

export const DEFAULT_ENCOURAGEMENT_PREFS: EncouragementPrefs = {
  enabled: false,
  minMinutes: 15,
  maxMinutes: 45,
  phrases: [],
};

function clampMinutes(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(240, Math.max(1, Math.round(n)));
}

function normalizePhrase(raw: unknown): EncouragementPhrase | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  const author = typeof record.author === "string" ? record.author.trim() : "";
  if (!text) return null;
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : `enc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, text, author: author || "Anonymous" };
}

export function createEncouragementPhrase(
  text: string,
  author: string,
): EncouragementPhrase | null {
  const normalized = normalizePhrase({
    id: `enc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    author,
  });
  return normalized;
}

export function readEncouragementPrefs(): EncouragementPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_ENCOURAGEMENT_PREFS, phrases: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ENCOURAGEMENT_PREFS, phrases: [] };
    const parsed = JSON.parse(raw) as Partial<EncouragementPrefs>;
    let minMinutes = clampMinutes(parsed.minMinutes, DEFAULT_ENCOURAGEMENT_PREFS.minMinutes);
    let maxMinutes = clampMinutes(parsed.maxMinutes, DEFAULT_ENCOURAGEMENT_PREFS.maxMinutes);
    if (minMinutes > maxMinutes) {
      const swap = minMinutes;
      minMinutes = maxMinutes;
      maxMinutes = swap;
    }
    const phrases = Array.isArray(parsed.phrases)
      ? parsed.phrases.map(normalizePhrase).filter((p): p is EncouragementPhrase => Boolean(p))
      : [];
    return {
      enabled: Boolean(parsed.enabled),
      minMinutes,
      maxMinutes,
      phrases,
    };
  } catch {
    return { ...DEFAULT_ENCOURAGEMENT_PREFS, phrases: [] };
  }
}

export function writeEncouragementPrefs(
  partial: Partial<EncouragementPrefs>,
): EncouragementPrefs {
  const current = readEncouragementPrefs();
  let next: EncouragementPrefs = {
    ...current,
    ...partial,
    phrases: partial.phrases ?? current.phrases,
  };
  next = {
    ...next,
    minMinutes: clampMinutes(next.minMinutes, DEFAULT_ENCOURAGEMENT_PREFS.minMinutes),
    maxMinutes: clampMinutes(next.maxMinutes, DEFAULT_ENCOURAGEMENT_PREFS.maxMinutes),
  };
  if (next.minMinutes > next.maxMinutes) {
    const swap = next.minMinutes;
    next = { ...next, minMinutes: next.maxMinutes, maxMinutes: swap };
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

/** Random delay in ms within [minMinutes, maxMinutes]. */
export function randomEncouragementDelayMs(minMinutes: number, maxMinutes: number): number {
  const min = Math.min(minMinutes, maxMinutes);
  const max = Math.max(minMinutes, maxMinutes);
  const minutes = min + Math.random() * (max - min);
  return Math.max(60_000, Math.round(minutes * 60_000));
}

export function pickRandomPhrase(
  phrases: EncouragementPhrase[],
): EncouragementPhrase | null {
  const usable = phrases.filter((p) => p.text.trim());
  if (usable.length === 0) return null;
  const picked = usable[Math.floor(Math.random() * usable.length)];
  if (!picked) return null;
  return {
    ...picked,
    author: picked.author.trim() || "Anonymous",
  };
}
