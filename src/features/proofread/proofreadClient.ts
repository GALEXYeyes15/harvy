import type { ProofreadIssue, ProofreadIssueType } from "./types";

const DEFAULT_PATH = "/api/proofread";

function isIssueType(v: unknown): v is ProofreadIssueType {
  return v === "spelling" || v === "grammar" || v === "suggestion";
}

function parseIssuesPayload(raw: unknown, inputLength: number): ProofreadIssue[] {
  if (!raw || typeof raw !== "object" || !("issues" in raw)) {
    return [];
  }
  const list = (raw as { issues?: unknown }).issues;
  if (!Array.isArray(list)) {
    return [];
  }
  const out: ProofreadIssue[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (!isIssueType(o.type)) continue;
    if (typeof o.text !== "string") continue;
    if (typeof o.start !== "number" || typeof o.end !== "number") continue;
    if (!Number.isInteger(o.start) || !Number.isInteger(o.end)) continue;
    if (o.start < 0 || o.end > inputLength || o.start >= o.end) continue;
    const suggestion =
      o.suggestion === undefined || o.suggestion === null
        ? undefined
        : typeof o.suggestion === "string"
          ? o.suggestion
          : undefined;
    out.push({
      type: o.type,
      text: o.text,
      suggestion,
      start: o.start,
      end: o.end,
    });
  }
  return out;
}

/**
 * POST proofread request. In dev, Vite serves `/api/proofread`.
 * Set `VITE_PROOFREAD_API_BASE` (e.g. `https://your-host`) if the API is hosted elsewhere (e.g. Tauri production).
 */
export async function requestProofread(text: string): Promise<ProofreadIssue[]> {
  const base = (import.meta.env.VITE_PROOFREAD_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";
  const url = `${base}${DEFAULT_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Proofread failed (${res.status})`);
  }

  const data: unknown = await res.json();
  if (!data || typeof data !== "object" || !("issues" in data)) {
    throw new Error("Invalid proofread response");
  }
  return parseIssuesPayload(data, text.length);
}
