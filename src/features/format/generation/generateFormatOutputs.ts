import { invoke } from "@tauri-apps/api/core";
import { collectInspirationExamplesForCategory } from "../../collect/collectFormatInspiration";
import type { CollectItem } from "../../collect/collectItems";
import { isTauriRuntime } from "../../save/saveRuntime";
import {
  FORMAT_CATEGORIES,
  hasSelectedFormatCategories,
  type FormatCategoryAmounts,
  type FormatCategorySelection,
} from "../formatCategories";
import type {
  FormatGenerationOrchestratorResult,
  FormatGenerationRequest,
} from "./orchestratorTypes";

const DEV_API_PATH = "/api/format/generate";

export type GenerateFormatOutputsParams = {
  essayTitle: string;
  essayText: string;
  wordCount: number;
  documentId?: string | null;
  selectedFormats: FormatCategorySelection;
  categoryAmounts: FormatCategoryAmounts;
  collectItems?: CollectItem[];
};

function buildFormatGenerationRequest(params: GenerateFormatOutputsParams): FormatGenerationRequest {
  const inspirationExamplesByCategory: FormatGenerationRequest["inspirationExamplesByCategory"] =
    Object.fromEntries(
      FORMAT_CATEGORIES.map((category) => [
        category.id,
        collectInspirationExamplesForCategory(params.collectItems ?? [], category.id),
      ]),
    );

  return {
    essayTitle: params.essayTitle,
    essayText: params.essayText,
    wordCount: params.wordCount,
    documentId: params.documentId ?? null,
    selectedFormats: params.selectedFormats,
    categoryAmounts: params.categoryAmounts,
    inspirationExamplesByCategory,
  };
}

/** Orchestrator client — one AI job per selected format; partial success preserved. */
export async function requestFormatGeneration(
  params: GenerateFormatOutputsParams,
): Promise<FormatGenerationOrchestratorResult> {
  if (!hasSelectedFormatCategories(params.selectedFormats)) {
    throw new Error("Select at least one format to generate");
  }

  const request = buildFormatGenerationRequest(params);

  if (isTauriRuntime()) {
    return invoke<FormatGenerationOrchestratorResult>("generate_format_outputs", { request });
  }

  return requestFormatGenerationDevApi(request);
}

async function requestFormatGenerationDevApi(
  request: FormatGenerationRequest,
): Promise<FormatGenerationOrchestratorResult> {
  const base = (import.meta.env.VITE_FORMAT_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";
  const url = `${base}${DEV_API_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Format generation failed (${res.status})`);
  }

  return (await res.json()) as FormatGenerationOrchestratorResult;
}
