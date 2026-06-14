import type { FormatInspirationExample } from "../../features/collect/collectFormatInspiration";
import { estimateFormatOutputCount } from "../../features/format/formatOutputEstimation";
import {
  FORMAT_CATEGORIES,
  type FormatCategoryAmounts,
  type FormatCategoryId,
  type FormatCategorySelection,
} from "../../features/format/formatCategories";
import type {
  FormatCategoryGenerationResult,
  FormatGenerationOrchestratorResult,
} from "../../features/format/generation/orchestratorTypes";
import { runFormatCategoryJob } from "./categoryJobs";

export type GenerateFormatOutputsInput = {
  essayText: string;
  wordCount: number;
  selectedFormats: FormatCategorySelection;
  categoryAmounts: FormatCategoryAmounts;
  inspirationExamplesByCategory?: Partial<Record<FormatCategoryId, FormatInspirationExample[]>>;
};

function selectedCategoryIds(selection: FormatCategorySelection): FormatCategoryId[] {
  return FORMAT_CATEGORIES.filter((category) => selection[category.id]).map((category) => category.id);
}

async function runCategoryJobSafe(
  category: FormatCategoryId,
  essayText: string,
  targetCount: number,
  inspirationExamples: FormatInspirationExample[],
): Promise<FormatCategoryGenerationResult> {
  try {
    const collection = await runFormatCategoryJob(category, essayText, targetCount, inspirationExamples);
    return {
      status: "success",
      category,
      type: "collection",
      title: collection.title,
      outputs: collection.items,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Format generation failed";
    return { status: "error", error: message };
  }
}

/** Server-side orchestrator — one independent AI job per selected output category. */
export async function generateFormatOutputs(
  input: GenerateFormatOutputsInput,
): Promise<FormatGenerationOrchestratorResult> {
  const trimmedEssay = input.essayText.trim();
  if (!trimmedEssay) {
    throw new Error("Essay text is empty");
  }

  const categories = selectedCategoryIds(input.selectedFormats);
  if (categories.length === 0) {
    throw new Error("Select at least one format to generate");
  }

  const jobs = categories.map((category) => {
    const targetCount = estimateFormatOutputCount(
      input.wordCount,
      input.categoryAmounts[category],
      category,
    );
    const inspirationExamples = input.inspirationExamplesByCategory?.[category] ?? [];
    return runCategoryJobSafe(category, trimmedEssay, targetCount, inspirationExamples).then(
      (result) => [category, result] as const,
    );
  });

  const settled = await Promise.all(jobs);
  return Object.fromEntries(settled) as FormatGenerationOrchestratorResult;
}
