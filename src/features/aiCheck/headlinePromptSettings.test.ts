import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEADLINE_STYLE_PROMPT,
  readHeadlineStylePrompt,
  resetHeadlineStylePrompt,
  writeHeadlineStylePrompt,
} from "./headlinePromptSettings";

describe("headlinePromptSettings", () => {
  it("returns the default prompt when nothing is stored", () => {
    localStorage.removeItem("harvy:headline-style-prompt");
    expect(readHeadlineStylePrompt()).toBe(DEFAULT_HEADLINE_STYLE_PROMPT);
  });

  it("round-trips a custom style prompt", () => {
    writeHeadlineStylePrompt("Punchy news headlines. No puns.");
    expect(readHeadlineStylePrompt()).toBe("Punchy news headlines. No puns.");
    expect(resetHeadlineStylePrompt()).toBe(DEFAULT_HEADLINE_STYLE_PROMPT);
    expect(readHeadlineStylePrompt()).toBe(DEFAULT_HEADLINE_STYLE_PROMPT);
  });
});
