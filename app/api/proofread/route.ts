import { runProofread } from "../../../src/server/openaiProofread";
import { ANTHROPIC_API_KEY_ENV } from "../../../src/config/aiConfig";

/**
 * Next.js App Router handler (optional deploy target).
 * Harvy’s Vite dev server uses `vite.config.ts` middleware for the same `/api/proofread` contract.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const text = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text : "";
  if (!text.trim()) {
    return new Response("No text provided", { status: 400 });
  }

  const apiKey = process.env[ANTHROPIC_API_KEY_ENV] ?? "";
  if (!apiKey) {
    return new Response(`${ANTHROPIC_API_KEY_ENV} not configured`, { status: 500 });
  }

  try {
    process.env[ANTHROPIC_API_KEY_ENV] = apiKey;
    const raw = await runProofread(text);
    let issues: unknown[] = [];
    try {
      const parsed = JSON.parse(raw) as { issues?: unknown };
      issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    } catch {
      issues = [];
    }
    return Response.json({ issues });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Proofread failed";
    return new Response(msg, { status: 500 });
  }
}
