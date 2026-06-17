/**
 * @deprecated Use `aiGenerationClient.ts` and `config/aiConfig.ts` instead.
 * Retained temporarily for reference; no longer used by Harvy generation paths.
 */
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export type OpenAIResponseShape = {
  output?: Array<{ content?: Array<{ text?: string }> }>;
  output_text?: string;
};

export function extractOpenAIOutputText(response: OpenAIResponseShape): string | undefined {
  const nested = response.output?.[0]?.content?.[0];
  if (
    nested &&
    typeof nested === "object" &&
    "text" in nested &&
    typeof (nested as { text: unknown }).text === "string"
  ) {
    return (nested as { text: string }).text;
  }
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  return undefined;
}
