import { isAllowedSpellingWord, registerCustomSpellingWords } from "./commonWordList";
import { normalizeSpellingToken } from "./spellingNormalize";

const STORAGE_KEY = "harvy:custom-spelling-dictionary";

/** Lowercase key → preferred display casing (first saved form). */
const customDictionaryDisplay = new Map<string, string>();

/** Per-document ignored words (session only, not persisted). */
const ignoredByDocument = new Map<string, Set<string>>();

let currentDocumentKey = "scratch";

function persistCustomDictionary(): void {
  if (typeof window === "undefined") return;
  const words = [...customDictionaryDisplay.entries()].map(([key, display]) => ({
    key,
    display,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

/** Load persisted custom dictionary and register with the spelling checker. */
export function initSpellingDictionary(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      if (typeof entry === "string" && entry.length > 0) {
        const key = normalizeSpellingToken(entry);
        customDictionaryDisplay.set(key, entry);
        continue;
      }
      if (
        entry &&
        typeof entry === "object" &&
        "key" in entry &&
        typeof (entry as { key: unknown }).key === "string"
      ) {
        const { key, display } = entry as { key: string; display?: string };
        const normalized = normalizeSpellingToken(key);
        if (normalized.length === 0) continue;
        const casing =
          typeof display === "string" && display.length > 0 ? display : key;
        customDictionaryDisplay.set(normalized, casing);
      }
    }
    registerCustomSpellingWords([...customDictionaryDisplay.values()]);
  } catch {
    // Ignore corrupt storage.
  }
}

if (typeof window !== "undefined") {
  initSpellingDictionary();
}

/** Scope ignored-word checks to the active document tab. */
export function setSpellingDocumentKey(documentKey: string): void {
  currentDocumentKey = documentKey || "scratch";
}

export function getSpellingDocumentKey(): string {
  return currentDocumentKey;
}

function ignoredForDocument(documentKey: string): Set<string> {
  let set = ignoredByDocument.get(documentKey);
  if (!set) {
    set = new Set();
    ignoredByDocument.set(documentKey, set);
  }
  return set;
}

/** True when the word is in the custom dictionary or ignored for the current document. */
export function isWordSpellingExempt(word: string): boolean {
  if (isAllowedSpellingWord(word)) return true;
  const key = normalizeSpellingToken(word);
  if (key.length === 0) return false;
  return ignoredForDocument(currentDocumentKey).has(key);
}

/** Add a word to the persistent custom dictionary (case-insensitive storage). */
export function addWordToCustomDictionary(word: string): void {
  const trimmed = word.trim();
  if (!trimmed) return;
  const key = normalizeSpellingToken(trimmed);
  if (key.length === 0) return;
  if (!customDictionaryDisplay.has(key)) {
    customDictionaryDisplay.set(key, trimmed);
  }
  registerCustomSpellingWords([trimmed]);
  persistCustomDictionary();
}

/** Ignore this spelling issue for the current document/session only. */
export function ignoreSpellingWordForDocument(word: string, documentKey?: string): void {
  const trimmed = word.trim();
  if (!trimmed) return;
  const key = normalizeSpellingToken(trimmed);
  if (key.length === 0) return;
  ignoredForDocument(documentKey ?? currentDocumentKey).add(key);
}

export function getCustomDictionaryDisplayWord(word: string): string | undefined {
  return customDictionaryDisplay.get(normalizeSpellingToken(word));
}
