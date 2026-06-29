const STORAGE_SPELL = "harvy:spellcheck";
const STORAGE_GRAMMAR = "harvy:grammar-checks";

export type WritingAssistancePrefs = {
  spellcheck: boolean;
  grammarChecks: boolean;
};

const defaultPrefs: WritingAssistancePrefs = {
  spellcheck: true,
  grammarChecks: true,
};

/** Live prefs for ProseMirror plugins (no editor remount on toggle). */
export const writingPrefsRef: WritingAssistancePrefs = { ...defaultPrefs };

export function readWritingAssistancePrefs(): WritingAssistancePrefs {
  if (typeof window === "undefined") return { ...defaultPrefs };
  return {
    spellcheck: localStorage.getItem(STORAGE_SPELL) !== "false",
    grammarChecks: localStorage.getItem(STORAGE_GRAMMAR) !== "false",
  };
}

if (typeof window !== "undefined") {
  const boot = readWritingAssistancePrefs();
  writingPrefsRef.spellcheck = boot.spellcheck;
  writingPrefsRef.grammarChecks = boot.grammarChecks;
}

export function writeWritingAssistancePrefs(partial: Partial<WritingAssistancePrefs>): WritingAssistancePrefs {
  const cur = readWritingAssistancePrefs();
  const next: WritingAssistancePrefs = { ...cur, ...partial };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_SPELL, next.spellcheck ? "true" : "false");
    localStorage.setItem(STORAGE_GRAMMAR, next.grammarChecks ? "true" : "false");
  }
  writingPrefsRef.spellcheck = next.spellcheck;
  writingPrefsRef.grammarChecks = next.grammarChecks;
  return next;
}

export function syncWritingPrefsRef(prefs: WritingAssistancePrefs): void {
  writingPrefsRef.spellcheck = prefs.spellcheck;
  writingPrefsRef.grammarChecks = prefs.grammarChecks;
}
