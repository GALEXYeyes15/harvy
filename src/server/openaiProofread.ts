import { extractOpenAIOutputText, getOpenAIClient, type OpenAIResponseShape } from "./openaiClient";

export async function runProofread(text: string): Promise<string> {
  if (!text) {
    return JSON.stringify({ issues: [] });
  }

  const response = await getOpenAIClient().responses.create({
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

  const output = extractOpenAIOutputText(response as OpenAIResponseShape);

  if (!output) {
    return JSON.stringify({ issues: [] });
  }

  return output;
}
