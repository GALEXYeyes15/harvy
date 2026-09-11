export type EditorPrompt = {
  id: string;
  text: string;
  /** Built-in prompt that cannot be edited or removed. */
  locked?: boolean;
};

export type EditorPromptPrefs = {
  prompts: EditorPrompt[];
};

export const DEFAULT_EDITOR_PROMPT_ID = "harvy-default-prompt";
export const DEFAULT_EDITOR_PROMPT_TEXT = "Start writing...";

export const DEFAULT_EDITOR_PROMPT: EditorPrompt = {
  id: DEFAULT_EDITOR_PROMPT_ID,
  text: DEFAULT_EDITOR_PROMPT_TEXT,
  locked: true,
};

const STORAGE_KEY = "harvy:editor-prompts";

function newPromptId(): string {
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePrompt(raw: unknown): EditorPrompt | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (id === DEFAULT_EDITOR_PROMPT_ID) return { ...DEFAULT_EDITOR_PROMPT };
  const text = typeof record.text === "string" ? record.text : "";
  return {
    id: id || newPromptId(),
    text,
    locked: false,
  };
}

export function createEditorPrompt(text = ""): EditorPrompt {
  return {
    id: newPromptId(),
    text,
    locked: false,
  };
}

/** Always keep the built-in prompt first; drop duplicate locked rows. */
export function ensureDefaultEditorPrompt(prompts: EditorPrompt[]): EditorPrompt[] {
  const custom = prompts.filter((prompt) => prompt.id !== DEFAULT_EDITOR_PROMPT_ID && !prompt.locked);
  return [{ ...DEFAULT_EDITOR_PROMPT }, ...custom];
}

export function readEditorPromptPrefs(): EditorPromptPrefs {
  if (typeof window === "undefined") {
    return { prompts: [{ ...DEFAULT_EDITOR_PROMPT }] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { prompts: [{ ...DEFAULT_EDITOR_PROMPT }] };
    const parsed = JSON.parse(raw) as Partial<EditorPromptPrefs>;
    const prompts = Array.isArray(parsed.prompts)
      ? parsed.prompts.map(normalizePrompt).filter((p): p is EditorPrompt => Boolean(p))
      : [];
    return { prompts: ensureDefaultEditorPrompt(prompts) };
  } catch {
    return { prompts: [{ ...DEFAULT_EDITOR_PROMPT }] };
  }
}

export function writeEditorPromptPrefs(
  partial: Partial<EditorPromptPrefs>,
): EditorPromptPrefs {
  const current = readEditorPromptPrefs();
  const next: EditorPromptPrefs = {
    prompts: ensureDefaultEditorPrompt(partial.prompts ?? current.prompts),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function updateEditorPrompt(
  prompts: EditorPrompt[],
  id: string,
  text: string,
): EditorPrompt[] {
  if (id === DEFAULT_EDITOR_PROMPT_ID) return ensureDefaultEditorPrompt(prompts);
  return ensureDefaultEditorPrompt(
    prompts.map((prompt) => (prompt.id === id ? { ...prompt, text } : prompt)),
  );
}

export function removeEditorPrompt(prompts: EditorPrompt[], id: string): EditorPrompt[] {
  if (id === DEFAULT_EDITOR_PROMPT_ID) return ensureDefaultEditorPrompt(prompts);
  return ensureDefaultEditorPrompt(prompts.filter((prompt) => prompt.id !== id));
}

/** Random non-empty prompt, including the built-in default. */
export function pickRandomEditorPrompt(prompts: EditorPrompt[]): string {
  const usable = ensureDefaultEditorPrompt(prompts)
    .map((prompt) => prompt.text.trim())
    .filter(Boolean);
  const picked = usable[Math.floor(Math.random() * usable.length)];
  return picked || DEFAULT_EDITOR_PROMPT_TEXT;
}
