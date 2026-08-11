import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import type { ProofreadIssue, ProofreadIssueType } from "../proofread/types";

export type AiProvider = "openai" | "anthropic";

export type AiCheckConfigPublic = {
  connected: boolean;
  provider: AiProvider | null;
  model: string;
  enabled: boolean;
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

export type AiCheckResult = {
  issues: AiCheckIssueRaw[];
  model: string;
  provider: AiProvider;
};

export type AiCheckSaveInput = {
  apiKey: string;
  model?: string;
  enabled?: boolean;
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

export function providerLabel(provider: AiProvider | null | undefined): string {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  return "Unknown";
}

function normalizeIssueType(raw: string): ProofreadIssueType {
  const t = raw.trim().toLowerCase();
  if (t === "spelling") return "spelling";
  if (t === "grammar") return "grammar";
  return "suggestion";
}

/**
 * Map model quotes to character offsets in the plain essay text.
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
    located.push({
      type: normalizeIssueType(raw.type),
      text: quote,
      suggestion: raw.suggestion?.trim() || undefined,
      message: raw.message?.trim() || undefined,
      start,
      end,
    });
    searchFrom = end;
  }

  return located;
}
