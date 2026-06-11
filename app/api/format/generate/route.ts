import { runTwitterFormatGeneration } from "../../../../src/server/openaiFormatGeneration";

/**
 * Next.js App Router handler (optional deploy target).
 * Harvy’s Vite dev server uses `vite.config.ts` middleware for the same `/api/format/generate` contract.
 *
 * TODO(format): dev/web fallback only — the Tauri app uses native `generate_twitter_formats`.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const platform = record.platform;
  if (platform !== "twitter") {
  // TODO(format): route to YouTube, Substack, Instagram, TikTok, LinkedIn handlers.
    return new Response("Only twitter format generation is supported", { status: 400 });
  }

  const essayText = typeof record.essayText === "string" ? record.essayText : "";
  const targetCount =
    typeof record.targetCount === "number" && Number.isFinite(record.targetCount)
      ? record.targetCount
      : 0;

  if (!essayText.trim()) {
    return new Response("No essay text provided", { status: 400 });
  }
  if (targetCount <= 0) {
    return new Response("Invalid target count", { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return new Response("OPENAI_API_KEY not configured", { status: 500 });
  }

  try {
    process.env.OPENAI_API_KEY = apiKey;
    const inspirationExamples = Array.isArray(record.inspirationExamples)
      ? record.inspirationExamples
      : [];
    const result = await runTwitterFormatGeneration(
      essayText,
      targetCount,
      inspirationExamples,
    );
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Format generation failed";
    return new Response(msg, { status: 500 });
  }
}
