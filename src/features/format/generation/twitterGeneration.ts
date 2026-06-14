import { invoke } from "@tauri-apps/api/core";
import type { FormatInspirationExample } from "../../collect/collectFormatInspiration";
import { isTauriRuntime } from "../../save/saveRuntime";
import type { FormatCollectionResult } from "../formatOutputTypes";
import { legacyTwitterResultFromCollection } from "../formatGenerationTypes";
import type { TwitterFormatGenerationResult } from "../formatGenerationTypes";
import { parseFormatCollectionResult } from "./parseFormatCollectionResult";

export type TweetsNotesFormatGenerateRequest = {
  essayTitle: string;
  essayText: string;
  targetCount: number;
  documentId?: string | null;
  inspirationExamples?: FormatInspirationExample[];
};

/** @deprecated Use TweetsNotesFormatGenerateRequest */
export type TwitterFormatGenerateRequest = TweetsNotesFormatGenerateRequest;

const DEV_API_PATH = "/api/format/generate";

export async function requestTweetsNotesFormatGeneration(
  request: TweetsNotesFormatGenerateRequest,
): Promise<FormatCollectionResult> {
  if (isTauriRuntime()) {
    return invoke<FormatCollectionResult>("generate_tweets_notes_formats", {
      essayTitle: request.essayTitle,
      essayText: request.essayText,
      targetCount: request.targetCount,
      documentId: request.documentId ?? null,
      inspirationExamples: request.inspirationExamples ?? [],
    });
  }

  const legacy = await requestTweetsNotesFormatGenerationDevApi(request);
  return parseFormatCollectionResult(legacy, "tweets_notes");
}

/** @deprecated Use requestTweetsNotesFormatGeneration */
export async function requestTwitterFormatGeneration(
  request: TweetsNotesFormatGenerateRequest,
): Promise<TwitterFormatGenerationResult> {
  const collection = await requestTweetsNotesFormatGeneration(request);
  return legacyTwitterResultFromCollection(collection);
}

async function requestTweetsNotesFormatGenerationDevApi(
  request: TweetsNotesFormatGenerateRequest,
): Promise<unknown> {
  const base = (import.meta.env.VITE_FORMAT_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";
  const url = `${base}${DEV_API_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "tweets_notes",
      essayText: request.essayText,
      targetCount: request.targetCount,
      inspirationExamples: request.inspirationExamples ?? [],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Format generation failed (${res.status})`);
  }

  return res.json();
}
