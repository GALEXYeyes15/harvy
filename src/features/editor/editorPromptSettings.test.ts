import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EDITOR_PROMPT_ID,
  DEFAULT_EDITOR_PROMPT_TEXT,
  createEditorPrompt,
  ensureDefaultEditorPrompt,
  pickRandomEditorPrompt,
  readEditorPromptPrefs,
  removeEditorPrompt,
  updateEditorPrompt,
  writeEditorPromptPrefs,
} from "./editorPromptSettings";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ensureDefaultEditorPrompt", () => {
  it("always puts the built-in prompt first", () => {
    const custom = createEditorPrompt("Call me Ishmael.");
    const next = ensureDefaultEditorPrompt([custom]);
    expect(next[0]?.id).toBe(DEFAULT_EDITOR_PROMPT_ID);
    expect(next[0]?.text).toBe(DEFAULT_EDITOR_PROMPT_TEXT);
    expect(next[1]?.text).toBe("Call me Ishmael.");
  });
});

describe("readEditorPromptPrefs", () => {
  it("returns only the default when nothing is stored", () => {
    const prefs = readEditorPromptPrefs();
    expect(prefs.prompts).toHaveLength(1);
    expect(prefs.prompts[0]?.id).toBe(DEFAULT_EDITOR_PROMPT_ID);
  });

  it("restores the default if storage omitted it", () => {
    localStorage.setItem(
      "harvy:editor-prompts",
      JSON.stringify({ prompts: [{ id: "custom-1", text: "Once upon a time" }] }),
    );
    const prefs = readEditorPromptPrefs();
    expect(prefs.prompts[0]?.id).toBe(DEFAULT_EDITOR_PROMPT_ID);
    expect(prefs.prompts.some((p) => p.text === "Once upon a time")).toBe(true);
  });
});

describe("updateEditorPrompt / removeEditorPrompt", () => {
  it("does not edit or remove the locked default", () => {
    const prompts = ensureDefaultEditorPrompt([createEditorPrompt("Hello")]);
    expect(updateEditorPrompt(prompts, DEFAULT_EDITOR_PROMPT_ID, "Nope")[0]?.text).toBe(
      DEFAULT_EDITOR_PROMPT_TEXT,
    );
    expect(removeEditorPrompt(prompts, DEFAULT_EDITOR_PROMPT_ID)).toHaveLength(2);
  });

  it("updates and removes custom prompts", () => {
    const custom = createEditorPrompt("Hello");
    const prompts = ensureDefaultEditorPrompt([custom]);
    const updated = updateEditorPrompt(prompts, custom.id, "Hello there");
    expect(updated.find((p) => p.id === custom.id)?.text).toBe("Hello there");
    expect(removeEditorPrompt(updated, custom.id)).toHaveLength(1);
  });
});

describe("pickRandomEditorPrompt", () => {
  it("returns the default when it is the only prompt", () => {
    expect(pickRandomEditorPrompt([])).toBe(DEFAULT_EDITOR_PROMPT_TEXT);
  });

  it("picks from non-empty prompts including the default", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const custom = createEditorPrompt("It was a dark and stormy night.");
    const picked = pickRandomEditorPrompt([custom]);
    expect(["Start writing...", "It was a dark and stormy night."]).toContain(picked);
  });

  it("skips blank custom rows", () => {
    const blank = createEditorPrompt("   ");
    expect(pickRandomEditorPrompt([blank])).toBe(DEFAULT_EDITOR_PROMPT_TEXT);
  });
});

describe("writeEditorPromptPrefs", () => {
  it("persists custom prompts with the default", () => {
    const custom = createEditorPrompt("Write the next sentence.");
    writeEditorPromptPrefs({ prompts: [custom] });
    const prefs = readEditorPromptPrefs();
    expect(prefs.prompts[0]?.locked).toBe(true);
    expect(prefs.prompts.some((p) => p.text === "Write the next sentence.")).toBe(true);
  });
});
