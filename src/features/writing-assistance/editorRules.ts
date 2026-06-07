import { invoke } from "@tauri-apps/api/core";
import basicRulesJson from "../../data/editorRules-basic.json";
import { isTauriRuntime } from "../save/saveRuntime";

export type HedgingPhraseRule = { pattern: string; flags: string };

export type EditorRulesJson = {
  version: number;
  adverbs: {
    lyPattern: string;
    lyFlags: string;
    ignoreLyWords: string[];
    nonLyAdverbs: string[];
    hedgingPhrases: HedgingPhraseRule[];
  };
  passive: {
    beForms: string[];
    irregularParticiples: string[];
    allowedFollowers: string[];
    participleSuffixPattern: string;
    /** Phrases (normalized whitespace, case-insensitive) that suppress a passive hit when the span matches. */
    exceptionPhrases: string[];
  };
  complexity: {
    thresholds: {
      minWordsUnlessStructured: number;
      minWordsForRelativeOnlyComplex: number;
      minStructuralPivotsForComplex: number;
    };
    weights: {
      structuralPivotSubordinator: number;
      structuralPivotConjunction: number;
      structuralPivotClauseAnd: number;
      relativeCountsTowardStructural: number;
    };
    clauseWords: {
      subordinators: string[];
      coordinatingConjunctions: string[];
      relatives: string[];
      clauseLinkingAnd: string;
    };
    clauseLinkingHints: {
      verbTailPattern: string;
      verbTailFlags: string;
      subjectHeadPattern: string;
      subjectHeadFlags: string;
    };
    punctuation: {
      comma: string;
      sentenceEndChars: string;
      splitTailWords: number;
      splitHeadWords: number;
    };
    layeredPatterns: {
      repeatedFramingPattern: string;
      repeatedFramingFlags: string;
      doubleFrontedSubordinationPattern: string;
      doubleFrontedSubordinationFlags: string;
      deepRelativeMinGap: number;
    };
    sentenceScoring: {
      wordCountComplex: number;
      wordCountVeryComplex: number;
      punctuationDensityMin: number;
      complexityThreshold: number;
      fkNormalization: {
        easyMax: number;
        moderateMax: number;
        hardMax: number;
        easyPoints: number;
        moderatePoints: number;
        hardPoints: number;
        veryHardPoints: number;
      };
    };
  };
};

const basicRules = basicRulesJson as EditorRulesJson;
let activeRules: EditorRulesJson = basicRules;
let loadPromise: Promise<EditorRulesJson> | null = null;

export function normalizePhrase(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileWordBoundaryList(words: string[], flags: string): RegExp {
  const body = words.map(escapeRe).join("|");
  return new RegExp(`\\b(?:${body})\\b`, flags);
}

export type CompiledEditorRules = {
  adverbs: {
    lyRe: RegExp;
    ignoreLy: Set<string>;
    nonLy: Set<string>;
    hedgingRes: RegExp[];
  };
  passive: {
    beForms: Set<string>;
    irregularParticiples: Set<string>;
    allowedFollowers: Set<string>;
    participleSuffix: RegExp;
    exceptionPhrasesNorm: Set<string>;
  };
  complexity: {
    thresholds: EditorRulesJson["complexity"]["thresholds"];
    weights: EditorRulesJson["complexity"]["weights"];
    subordinatorPivots: RegExp;
    conjunctionPivots: RegExp;
    relativePivots: RegExp;
    clauseAnd: RegExp;
    verbHint: RegExp;
    clauseSubjectHint: RegExp;
    punctuation: EditorRulesJson["complexity"]["punctuation"];
    layeredPatterns: {
      repeatedFraming: RegExp;
      doubleFronted: RegExp;
      deepRelativeRes: RegExp[];
    };
    leadingSubordinator: RegExp;
    commaCoordinating: RegExp;
    commaClauseAnd: RegExp;
    clauseLinkingAndWord: string;
    subordinatorWords: string[];
    coordinatingConjunctionWords: string[];
    relativePronounWords: string[];
    sentenceScoring: EditorRulesJson["complexity"]["sentenceScoring"];
  };
};

let cached: CompiledEditorRules | null = null;

/** Clears compiled-rule cache (e.g. after hot reload in dev). */
export function invalidateEditorRulesCache(): void {
  cached = null;
}

function compile(): CompiledEditorRules {
  const data = activeRules;

  const lyRe = new RegExp(data.adverbs.lyPattern, data.adverbs.lyFlags);
  const hedgingRes = data.adverbs.hedgingPhrases.map((h) => new RegExp(h.pattern, h.flags));

  const participleSuffix = new RegExp(data.passive.participleSuffixPattern, "i");

  const { clauseWords, clauseLinkingHints, layeredPatterns, punctuation, thresholds, weights } = data.complexity;
  const sentenceScoring =
    data.complexity.sentenceScoring ?? basicRules.complexity.sentenceScoring;

  const subordinatorPivots = compileWordBoundaryList(clauseWords.subordinators, "gi");
  const conjunctionPivots = compileWordBoundaryList(clauseWords.coordinatingConjunctions, "gi");
  const relativePivots = compileWordBoundaryList(clauseWords.relatives, "gi");
  const andEsc = escapeRe(clauseWords.clauseLinkingAnd);
  const clauseAnd = new RegExp(`\\b${andEsc}\\b`, "gi");

  const subAlt = clauseWords.subordinators.map(escapeRe).join("|");
  const leadingSubordinator = new RegExp(`^\\s*(?:${subAlt})\\b`, "i");
  const coordAlt = clauseWords.coordinatingConjunctions.map(escapeRe).join("|");
  const commaCoordinating = new RegExp(`,\\s*(?:${coordAlt})\\b`, "i");
  const commaClauseAnd = new RegExp(`,\\s*${andEsc}\\b`, "i");

  const gap = layeredPatterns.deepRelativeMinGap;
  const g = String(gap);
  const deepRelativeRes = [
    new RegExp(`\\bthat\\b[^.!?]{${g},}\\b(which|that|who)\\b`, "i"),
    new RegExp(`\\bwhich\\b[^.!?]{${g},}\\b(that|who)\\b`, "i"),
    new RegExp(`\\bwho\\b[^.!?]{${g},}\\b(which|that)\\b`, "i"),
  ];

  const exceptionPhrasesNorm = new Set(
    (data.passive.exceptionPhrases ?? []).map((p) => normalizePhrase(p)).filter(Boolean),
  );

  return {
    adverbs: {
      lyRe,
      ignoreLy: new Set(data.adverbs.ignoreLyWords.map((w) => w.toLowerCase())),
      nonLy: new Set(data.adverbs.nonLyAdverbs.map((w) => w.toLowerCase())),
      hedgingRes,
    },
    passive: {
      beForms: new Set(data.passive.beForms.map((w) => w.toLowerCase())),
      irregularParticiples: new Set(data.passive.irregularParticiples.map((w) => w.toLowerCase())),
      allowedFollowers: new Set(data.passive.allowedFollowers.map((w) => w.toLowerCase())),
      participleSuffix,
      exceptionPhrasesNorm,
    },
    complexity: {
      thresholds,
      weights,
      subordinatorPivots,
      conjunctionPivots,
      relativePivots,
      clauseAnd,
      verbHint: new RegExp(clauseLinkingHints.verbTailPattern, clauseLinkingHints.verbTailFlags),
      clauseSubjectHint: new RegExp(
        clauseLinkingHints.subjectHeadPattern,
        clauseLinkingHints.subjectHeadFlags,
      ),
      punctuation,
      layeredPatterns: {
        repeatedFraming: new RegExp(
          layeredPatterns.repeatedFramingPattern,
          layeredPatterns.repeatedFramingFlags,
        ),
        doubleFronted: new RegExp(
          layeredPatterns.doubleFrontedSubordinationPattern,
          layeredPatterns.doubleFrontedSubordinationFlags,
        ),
        deepRelativeRes,
      },
      leadingSubordinator,
      commaCoordinating,
      commaClauseAnd,
      clauseLinkingAndWord: clauseWords.clauseLinkingAnd,
      subordinatorWords: [...clauseWords.subordinators],
      coordinatingConjunctionWords: [...clauseWords.coordinatingConjunctions],
      relativePronounWords: [...clauseWords.relatives],
      sentenceScoring,
    },
  };
}

/**
 * Compiled detectors from `editorRules-basic.json` (cached).
 * Flow: JSON → compile() → RegExp / Set → detectors.
 */
export function getCompiledEditorRules(): CompiledEditorRules {
  if (!cached) cached = compile();
  return cached;
}

function parseRulesJson(raw: string): EditorRulesJson {
  return JSON.parse(raw) as EditorRulesJson;
}

/**
 * Full path to persisted user rules file in app config dir.
 * Returns `null` outside Tauri runtime.
 */
export async function getUserRulesFilePath(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string>("get_user_editor_rules_path");
}

/** Creates `editorRules-user.json` from bundled defaults if missing. */
export async function ensureUserRulesFile(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const path = await invoke<string>("ensure_user_editor_rules", {
    basicRulesJson: JSON.stringify(basicRules, null, 2),
  });
  return path;
}

/**
 * Loads active rules with persistent user file precedence:
 * `editorRules-user.json` (if present) else bundled `editorRules-basic.json`.
 */
export async function loadEditorRules(): Promise<EditorRulesJson> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (!isTauriRuntime()) {
      activeRules = basicRules;
      invalidateEditorRulesCache();
      return activeRules;
    }
    const raw = await invoke<string | null>("read_user_editor_rules");
    activeRules = raw ? parseRulesJson(raw) : basicRules;
    invalidateEditorRulesCache();
    return activeRules;
  })();
  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

/** Persist user rules to disk and refresh compiled-rule cache. */
export async function saveUserRules(updatedRulesJson: EditorRulesJson): Promise<void> {
  if (!isTauriRuntime()) {
    activeRules = updatedRulesJson;
    invalidateEditorRulesCache();
    return;
  }
  await invoke("write_user_editor_rules", {
    contents: JSON.stringify(updatedRulesJson, null, 2),
  });
  activeRules = updatedRulesJson;
  invalidateEditorRulesCache();
}
