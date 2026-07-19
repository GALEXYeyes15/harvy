import { FK_SENTENCE_COMPLEXITY_THRESHOLD } from "../readability";

const STORAGE_KEY = "harvy:parameters";

/** Default matches the previous fixed sidebar estimate. */
export const DEFAULT_READING_WPM = 300;

/** Inclusive suggested range shown in Settings (typical adult silent reading). */
export const SUGGESTED_READING_WPM_MIN = 200;
export const SUGGESTED_READING_WPM_MAX = 350;

export const READING_WPM_MIN = 100;
export const READING_WPM_MAX = 600;

/** Default matches the previous fixed sentence-complexity cutoff. */
export const DEFAULT_FK_COMPLEXITY_THRESHOLD = FK_SENTENCE_COMPLEXITY_THRESHOLD;

/** Inclusive suggested range for punchy vs denser prose. */
export const SUGGESTED_FK_COMPLEXITY_THRESHOLD_MIN = 7;
export const SUGGESTED_FK_COMPLEXITY_THRESHOLD_MAX = 12;

export const FK_COMPLEXITY_THRESHOLD_MIN = 1;
export const FK_COMPLEXITY_THRESHOLD_MAX = 20;

export type ParametersPrefs = {
  /** Words per minute used for reading-time estimates. */
  readingWordsPerMinute: number;
  /** Flesch–Kincaid density at/above which a sentence is marked complex. */
  fkComplexityThreshold: number;
};

export const DEFAULT_PARAMETERS_PREFS: ParametersPrefs = {
  readingWordsPerMinute: DEFAULT_READING_WPM,
  fkComplexityThreshold: DEFAULT_FK_COMPLEXITY_THRESHOLD,
};

/** Live prefs for ProseMirror plugins (no editor remount on change). */
export const parametersPrefsRef: ParametersPrefs = { ...DEFAULT_PARAMETERS_PREFS };

export function clampReadingWordsPerMinute(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_READING_WPM;
  return Math.min(READING_WPM_MAX, Math.max(READING_WPM_MIN, Math.round(n)));
}

export function clampFkComplexityThreshold(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_FK_COMPLEXITY_THRESHOLD;
  return Math.min(
    FK_COMPLEXITY_THRESHOLD_MAX,
    Math.max(FK_COMPLEXITY_THRESHOLD_MIN, Math.round(n)),
  );
}

export function readParametersPrefs(): ParametersPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PARAMETERS_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PARAMETERS_PREFS };
    const parsed = JSON.parse(raw) as Partial<ParametersPrefs>;
    return {
      readingWordsPerMinute: clampReadingWordsPerMinute(
        parsed.readingWordsPerMinute ?? DEFAULT_READING_WPM,
      ),
      fkComplexityThreshold: clampFkComplexityThreshold(
        parsed.fkComplexityThreshold ?? DEFAULT_FK_COMPLEXITY_THRESHOLD,
      ),
    };
  } catch {
    return { ...DEFAULT_PARAMETERS_PREFS };
  }
}

function syncParametersPrefsRef(prefs: ParametersPrefs): void {
  parametersPrefsRef.readingWordsPerMinute = prefs.readingWordsPerMinute;
  parametersPrefsRef.fkComplexityThreshold = prefs.fkComplexityThreshold;
}

if (typeof window !== "undefined") {
  syncParametersPrefsRef(readParametersPrefs());
}

export function writeParametersPrefs(partial: Partial<ParametersPrefs>): ParametersPrefs {
  const current = readParametersPrefs();
  const next: ParametersPrefs = {
    readingWordsPerMinute: clampReadingWordsPerMinute(
      partial.readingWordsPerMinute ?? current.readingWordsPerMinute,
    ),
    fkComplexityThreshold: clampFkComplexityThreshold(
      partial.fkComplexityThreshold ?? current.fkComplexityThreshold,
    ),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  syncParametersPrefsRef(next);
  return next;
}
