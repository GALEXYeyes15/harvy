const STORAGE_PROSE = "harvy:enable-prose-checks";
const STORAGE_MECHANICS = "harvy:enable-mechanics-checks";
/** Legacy keys — read for migration only. */
const STORAGE_SPELL = "harvy:spellcheck";
const STORAGE_GRAMMAR = "harvy:grammar-checks";

export type WritingAssistancePrefs = {
  enableProseChecks: boolean;
  enableMechanicsChecks: boolean;
};

const defaultPrefs: WritingAssistancePrefs = {
  enableProseChecks: true,
  enableMechanicsChecks: true,
};

/** Live prefs for ProseMirror plugins (no editor remount on toggle). */
export const writingPrefsRef: WritingAssistancePrefs = { ...defaultPrefs };

function readStoredBool(key: string): boolean | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(key);
  if (value === null) return null;
  return value !== "false";
}

export function readWritingAssistancePrefs(): WritingAssistancePrefs {
  if (typeof window === "undefined") return { ...defaultPrefs };

  const proseStored = readStoredBool(STORAGE_PROSE);
  const mechanicsStored = readStoredBool(STORAGE_MECHANICS);

  return {
    enableProseChecks:
      proseStored ?? readStoredBool(STORAGE_GRAMMAR) ?? defaultPrefs.enableProseChecks,
    enableMechanicsChecks:
      mechanicsStored ?? readStoredBool(STORAGE_SPELL) ?? defaultPrefs.enableMechanicsChecks,
  };
}

if (typeof window !== "undefined") {
  const boot = readWritingAssistancePrefs();
  writingPrefsRef.enableProseChecks = boot.enableProseChecks;
  writingPrefsRef.enableMechanicsChecks = boot.enableMechanicsChecks;
}

export function writeWritingAssistancePrefs(
  partial: Partial<WritingAssistancePrefs>,
): WritingAssistancePrefs {
  const cur = readWritingAssistancePrefs();
  const next: WritingAssistancePrefs = { ...cur, ...partial };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_PROSE, next.enableProseChecks ? "true" : "false");
    localStorage.setItem(STORAGE_MECHANICS, next.enableMechanicsChecks ? "true" : "false");
  }
  writingPrefsRef.enableProseChecks = next.enableProseChecks;
  writingPrefsRef.enableMechanicsChecks = next.enableMechanicsChecks;
  return next;
}

export function syncWritingPrefsRef(prefs: WritingAssistancePrefs): void {
  writingPrefsRef.enableProseChecks = prefs.enableProseChecks;
  writingPrefsRef.enableMechanicsChecks = prefs.enableMechanicsChecks;
}
