import { describe, expect, it } from "vitest";
import { substackNoteDocToPlainText } from "./substackNoteBody";

describe("substackNoteDocToPlainText", () => {
  it("formats bullet and ordered lists for plain Notes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "The most powerful systems in life are hard to detect:" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Belief systems" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "habitual systems" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "political systems" }] },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }],
            },
          ],
        },
      ],
    };

    expect(substackNoteDocToPlainText(doc)).toBe(
      [
        "The most powerful systems in life are hard to detect:",
        "- Belief systems",
        "- habitual systems",
        "- political systems",
        "1. First",
        "2. Second",
      ].join("\n"),
    );
  });
});
