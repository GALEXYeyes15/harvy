import { invoke } from "@tauri-apps/api/core";
import type { FormatInspirationExample } from "../../collect/collectFormatInspiration";
import { isTauriRuntime } from "../../save/saveRuntime";
import type { TwitterFormatGenerationResult } from "../formatGenerationTypes";
import { parseTwitterFormatGenerationResult } from "./parseTwitterFormatResult";

export type TwitterFormatGenerateRequest = {
  essayTitle: string;
  essayText: string;
  targetCount: number;
  documentId?: string | null;
  inspirationExamples?: FormatInspirationExample[];
};

const DEV_API_PATH = "/api/format/generate";

/** Primary: native Tauri command. Fallback: dev-only Vite `/api/format/generate` route. */
export async function requestTwitterFormatGeneration(
  request: TwitterFormatGenerateRequest,
): Promise<TwitterFormatGenerationResult> {
  if (isTauriRuntime()) {
    return invoke<TwitterFormatGenerationResult>("generate_twitter_formats", {
      essayTitle: request.essayTitle,
      essayText: request.essayText,
      targetCount: request.targetCount,
      documentId: request.documentId ?? null,
      inspirationExamples: request.inspirationExamples ?? [],
    });
  }

  return requestTwitterFormatGenerationDevApi(request);
}

/** Dev/web fallback — not used in Tauri production builds. */
async function requestTwitterFormatGenerationDevApi(
  request: TwitterFormatGenerateRequest,
): Promise<TwitterFormatGenerationResult> {
  const base = (import.meta.env.VITE_FORMAT_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";
  const url = `${base}${DEV_API_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: "twitter",
      essayText: request.essayText,
      targetCount: request.targetCount,
      inspirationExamples: request.inspirationExamples ?? [],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Format generation failed (${res.status})`);
  }

  const data: unknown = await res.json();
  return parseTwitterFormatGenerationResult(data);
}

// TODO(format): requestYouTubeFormatGeneration via generate_youtube_formats
