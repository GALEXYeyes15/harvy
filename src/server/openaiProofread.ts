import OpenAI from "openai";

/**
 * Lazy client: `vite.config.ts` sets `process.env.OPENAI_API_KEY` from `loadEnv` before each request,
 * so the key must not be read only at module load time (it is often empty then).
 */
let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

function extractOutputText(response: OpenAIResponseShape): string | undefined {
  const nested = response.output?.[0]?.content?.[0];
  if (nested && typeof nested === "object" && "text" in nested && typeof (nested as { text: unknown }).text === "string") {
    return (nested as { text: string }).text;
  }
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  return undefined;
}

/** Narrow type for output extraction without importing full SDK internals */
type OpenAIResponseShape = {
  output?: Array<{ content?: Array<{ text?: string }> }>;
  output_text?: string;
};

export async function runProofread(text: string): Promise<string> {
  if (!text) {
    return JSON.stringify({ issues: [] });
  }

  const response = await getClient().responses.create({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content: `
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
      },
      {
        role: "user",
        content: text,
      },
    ],
    text: {
      format: { type: "json_object" },
    },
  });

  const output = extractOutputText(response as OpenAIResponseShape);

  if (!output) {
    return JSON.stringify({ issues: [] });
  }

  return output;
}
