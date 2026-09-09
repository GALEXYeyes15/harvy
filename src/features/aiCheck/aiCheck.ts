import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import type { ProofreadIssue } from "../proofread/types";
import { ensurePodcastNotesBullets } from "./podcastNotesMarkdown";

export type AiProvider = "openai" | "anthropic";

export type AiCheckConfigPublic = {
  connected: boolean;
  provider: AiProvider | null;
  model: string;
  enabled: boolean;
  showReplaceSuggestions: boolean;
  hasApiKey: boolean;
};

export type AiModelInfo = {
  id: string;
  provider: AiProvider;
};

export type AiCheckIssueRaw = {
  type: string;
  text: string;
  suggestion?: string | null;
  message?: string | null;
};

export type AiCheckUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AiCheckResult = {
  issues: AiCheckIssueRaw[];
  model: string;
  provider: AiProvider;
  usage: AiCheckUsage;
};

export type PodcastNotesResult = {
  markdown: string;
  model: string;
  provider: AiProvider;
  usage: AiCheckUsage;
};

export type AiCheckSaveInput = {
  apiKey: string;
  model?: string;
  enabled?: boolean;
  showReplaceSuggestions?: boolean;
  keepExistingKey?: boolean;
};

function requireTauri(): void {
  if (!isTauriRuntime()) {
    throw new Error("AI check requires the Harvy desktop app.");
  }
}

export async function getAiCheckConfig(): Promise<AiCheckConfigPublic> {
  requireTauri();
  return invoke<AiCheckConfigPublic>("ai_check_get_config");
}

export async function saveAiCheckConfig(input: AiCheckSaveInput): Promise<AiCheckConfigPublic> {
  requireTauri();
  return invoke<AiCheckConfigPublic>("ai_check_save_config", { input });
}

export async function setAiCheckEnabled(enabled: boolean): Promise<AiCheckConfigPublic> {
  requireTauri();
  return invoke<AiCheckConfigPublic>("ai_check_set_enabled", { enabled });
}

export async function setAiCheckShowReplaceSuggestions(
  showReplaceSuggestions: boolean,
): Promise<AiCheckConfigPublic> {
  requireTauri();
  return invoke<AiCheckConfigPublic>("ai_check_set_show_replace_suggestions", {
    showReplaceSuggestions,
  });
}

export async function clearAiCheckConfig(): Promise<AiCheckConfigPublic> {
  requireTauri();
  return invoke<AiCheckConfigPublic>("ai_check_clear_config");
}

export async function detectAiProvider(apiKey: string): Promise<AiProvider> {
  requireTauri();
  return invoke<AiProvider>("ai_check_detect_provider", { apiKey });
}

export async function listAiModels(apiKey?: string): Promise<AiModelInfo[]> {
  requireTauri();
  return invoke<AiModelInfo[]>("ai_check_list_models", {
    apiKey: apiKey?.trim() ? apiKey : null,
  });
}

export async function testAiCheckConnection(opts?: {
  apiKey?: string;
  model?: string;
}): Promise<string> {
  requireTauri();
  return invoke<string>("ai_check_test_connection", {
    apiKey: opts?.apiKey?.trim() ? opts.apiKey : null,
    model: opts?.model?.trim() ? opts.model : null,
  });
}

export async function runAiCheck(essay: string): Promise<AiCheckResult> {
  requireTauri();
  return invoke<AiCheckResult>("ai_check_run", { essay });
}

export async function generatePodcastNotes(essay: string): Promise<PodcastNotesResult> {
  requireTauri();
  const result = await invoke<PodcastNotesResult>("ai_check_podcast_notes", { essay });
  return { ...result, markdown: ensurePodcastNotesBullets(result.markdown) };
}

export type HeadlinePair = {
  title: string;
  subtitle: string;
};

export type HeadlinePairsResult = {
  pairs: HeadlinePair[];
  model: string;
  provider: AiProvider;
  usage: AiCheckUsage;
};

export async function generateHeadlinePairs(
  essay: string,
  stylePrompt?: string,
): Promise<HeadlinePairsResult> {
  requireTauri();
  return invoke<HeadlinePairsResult>("ai_check_headline_pairs", {
    essay,
    stylePrompt: stylePrompt?.trim() ? stylePrompt : null,
  });
}

export type HeadlineVisionImageInput = {
  mimeType: string;
  dataBase64: string;
};

export async function generateHeadlinePairsFromShots(
  essay: string,
  images: HeadlineVisionImageInput[],
  stylePrompt?: string,
): Promise<HeadlinePairsResult> {
  requireTauri();
  return invoke<HeadlinePairsResult>("ai_check_headline_pairs_from_shots", {
    essay,
    stylePrompt: stylePrompt?.trim() ? stylePrompt : null,
    images,
  });
}

export function providerLabel(provider: AiProvider | null | undefined): string {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  return "Unknown";
}

export {
  estimateAiCheckCostFromEssay,
  estimateCostUsd,
  formatAiCheckCostUsd,
  formatAiModelDisplayName,
  formatModelRatesShort,
  isRecommendedHarvyModel,
  modelOptionLabel,
  pickRecommendedModelId,
  sortModelsByCost,
} from "./aiCheckCost";

/**
 * Map model quotes to character offsets in the plain essay text.
 * Always tagged as `ai` so the editor can use solid underlines + AI popovers.
 * Skips quotes that cannot be found exactly (LLMs occasionally paraphrase).
 */
export function locateAiIssuesInText(
  essay: string,
  rawIssues: AiCheckIssueRaw[],
): ProofreadIssue[] {
  const located: ProofreadIssue[] = [];
  let searchFrom = 0;

  for (const raw of rawIssues) {
    const quote = raw.text.trim();
    if (!quote) continue;

    let start = essay.indexOf(quote, searchFrom);
    if (start < 0) {
      start = essay.indexOf(quote);
    }
    if (start < 0) continue;

    const end = start + quote.length;
    const category = raw.type.trim().toLowerCase();
    const message =
      raw.message?.trim() ||
      (category === "grammar" || category === "spelling"
        ? "Possible grammar issue"
        : "Style suggestion");
    located.push({
      type: "ai",
      text: quote,
      suggestion: raw.suggestion?.trim() || undefined,
      message,
      start,
      end,
    });
    searchFrom = end;
  }

  return located;
}

/**
 * Drop AI issues that were replaced/edited away, and re-anchor surviving quotes
 * when earlier edits shifted offsets. Used so sidebar counts stay in sync.
 */
export function reconcileAiIssuesInText(
  essay: string,
  issues: ProofreadIssue[],
): ProofreadIssue[] {
  const kept: ProofreadIssue[] = [];
  let searchFrom = 0;

  for (const issue of issues) {
    if (issue.type !== "ai") {
      kept.push(issue);
      continue;
    }

    const quote = issue.text;
    if (!quote) continue;

    if (
      issue.start >= 0 &&
      issue.end <= essay.length &&
      essay.slice(issue.start, issue.end) === quote
    ) {
      kept.push(issue);
      searchFrom = Math.max(searchFrom, issue.end);
      continue;
    }

    let start = essay.indexOf(quote, searchFrom);
    if (start < 0) {
      start = essay.indexOf(quote);
    }
    if (start < 0) continue;

    const end = start + quote.length;
    kept.push({ ...issue, start, end });
    searchFrom = end;
  }

  return kept;
}
