import type { FormatGenerationRequest } from "../../../../src/features/format/generation/orchestratorTypes";
import { generateFormatOutputs } from "../../../../src/server/formatGeneration/orchestrator";
import { ANTHROPIC_API_KEY_ENV } from "../../../../src/config/aiConfig";

/**
 * Next.js App Router handler (optional deploy target).
 * Harvy’s Vite dev server uses `vite.config.ts` middleware for the same `/api/format/generate` contract.
 *
 * Dev/web fallback only — the Tauri app uses native `generate_format_outputs`.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = body as Partial<FormatGenerationRequest>;
  const essayText = typeof record.essayText === "string" ? record.essayText : "";
  const wordCount =
    typeof record.wordCount === "number" && Number.isFinite(record.wordCount) ? record.wordCount : 0;

  if (!essayText.trim()) {
    return new Response("No essay text provided", { status: 400 });
  }
  if (!record.selectedFormats || !record.categoryAmounts) {
    return new Response("Missing format selection or amounts", { status: 400 });
  }

  const apiKey = process.env[ANTHROPIC_API_KEY_ENV] ?? "";
  if (!apiKey) {
    return new Response(`${ANTHROPIC_API_KEY_ENV} not configured`, { status: 500 });
  }

  try {
    process.env[ANTHROPIC_API_KEY_ENV] = apiKey;
    const result = await generateFormatOutputs({
      essayText,
      wordCount,
      selectedFormats: record.selectedFormats,
      categoryAmounts: record.categoryAmounts,
      inspirationExamplesByCategory: record.inspirationExamplesByCategory,
    });
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Format generation failed";
    return new Response(msg, { status: 500 });
  }
}
