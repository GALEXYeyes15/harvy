import {
  ANTHROPIC_API_KEY_ENV,
  ANTHROPIC_API_VERSION,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_MODEL,
} from "../config/aiConfig";

export { DEFAULT_MODEL } from "../config/aiConfig";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

type AnthropicContentBlock = {
  type?: string;
  text?: string;
};

type AnthropicMessageResponse = {
  content?: AnthropicContentBlock[];
};

export function getAnthropicApiKey(): string {
  const apiKey = process.env[ANTHROPIC_API_KEY_ENV]?.trim() ?? "";
  if (import.meta.env.DEV) {
    console.log("[harvy] getAnthropicApiKey (Node/Vite server)", {
      location: "src/server/aiGenerationClient.ts",
      keyPresent: Boolean(process.env[ANTHROPIC_API_KEY_ENV]),
      keyNonempty: Boolean(apiKey),
    });
  }
  if (!apiKey) {
    throw new Error(`${ANTHROPIC_API_KEY_ENV} is not configured`);
  }
  return apiKey;
}

function extractAnthropicOutputText(response: AnthropicMessageResponse): string | undefined {
  for (const block of response.content ?? []) {
    if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
      return block.text;
    }
  }
  return undefined;
}

/**
 * Run a JSON-oriented generation job using Harvy's default model.
 * Preserves the existing system/user prompt split used by proofread and format jobs.
 */
export async function runJsonGenerationJob(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = getAnthropicApiKey();

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const responseText = await response.text();
  if (import.meta.env.DEV) {
    console.log("RAW ANTHROPIC ENVELOPE", responseText);
  }
  if (!response.ok) {
    throw new Error(`Anthropic error (${response.status}): ${responseText}`);
  }

  let payload: AnthropicMessageResponse;
  try {
    payload = JSON.parse(responseText) as AnthropicMessageResponse;
  } catch {
    throw new Error("Anthropic returned invalid JSON envelope");
  }

  const output = extractAnthropicOutputText(payload);
  if (!output) {
    throw new Error("Anthropic returned an empty response");
  }

  if (import.meta.env.DEV) {
    console.log("RAW ANTHROPIC MODEL TEXT", output);
  }

  return output;
}
