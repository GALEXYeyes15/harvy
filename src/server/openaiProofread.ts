import { runJsonGenerationJob } from "./aiGenerationClient";
import { parseModelJsonText } from "./parseModelJson";

export async function runProofread(text: string): Promise<string> {
  if (!text) {
    return JSON.stringify({ issues: [] });
  }

  const output = await runJsonGenerationJob(
    `
You are a writing assistant.

Return your response strictly as a JSON object.

Analyze the text and identify:
- spelling errors
- grammar errors
- clarity or style suggestions

Return ONLY valid JSON in this format:

{
  "issues": [
    {
      "type": "spelling" | "grammar" | "suggestion",
      "text": "exact substring from input",
      "suggestion": "optional improved version",
      "start": number,
      "end": number
    }
  ]
}

Rules:
- Do NOT rewrite the full text
- Only return JSON
- Do NOT include explanations
- Use exact character positions from the original input
- Be conservative: if uncertain, do not emit an issue
- Only emit "grammar" for objective grammatical errors (not style)
- Only emit "suggestion" for clear clarity problems; otherwise omit it
`,
    text,
  );

  if (!output) {
    return JSON.stringify({ issues: [] });
  }

  const parsed = parseModelJsonText(output, "proofread");
  return JSON.stringify(parsed);
}
