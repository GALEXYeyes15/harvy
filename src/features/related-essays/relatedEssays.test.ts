import { describe, expect, it } from "vitest";
import {
  collectEssayMarkdownFiles,
  excerptFromMarkdown,
  isEssayMarkdownFileName,
  parseRelatedEssayItems,
  preferredRelatedUrl,
} from "./relatedEssays";
import { normalizeEssayTitle, titlesMatch } from "./titleMatch";

describe("related essays", () => {
  it("skips notes, criteria, and non-markdown files", () => {
    expect(isEssayMarkdownFileName("Ambition.md")).toBe(true);
    expect(isEssayMarkdownFileName("Ambition Note.md")).toBe(false);
    expect(isEssayMarkdownFileName("Ambition Criteria.md")).toBe(false);
    expect(isEssayMarkdownFileName("cover.png")).toBe(false);
  });

  it("walks a workspace tree for essay files", () => {
    const files = collectEssayMarkdownFiles({
      name: "Essays",
      path: "/Essays",
      kind: "directory",
      children: [
        {
          name: "Ambition",
          path: "/Essays/Ambition",
          kind: "directory",
          children: [
            { name: "Ambition.md", path: "/Essays/Ambition/Ambition.md", kind: "file" },
            { name: "Ambition Note.md", path: "/Essays/Ambition/Notes/Ambition Note.md", kind: "file" },
          ],
        },
        { name: "Other.md", path: "/Essays/Other.md", kind: "file" },
      ],
    });
    expect(files.map((file) => file.path)).toEqual([
      "/Essays/Ambition/Ambition.md",
      "/Essays/Other.md",
    ]);
  });

  it("prefers the public URL, then the Notion URL", () => {
    expect(
      preferredRelatedUrl({
        publicUrl: "https://alex.substack.com/p/hello",
        notionUrl: "https://www.notion.so/hello",
      }),
    ).toBe("https://alex.substack.com/p/hello");
    expect(preferredRelatedUrl({ notionUrl: "https://www.notion.so/hello" })).toBe(
      "https://www.notion.so/hello",
    );
    expect(preferredRelatedUrl({})).toBe("");
  });

  it("parses a related sidecar list", () => {
    expect(
      parseRelatedEssayItems(
        JSON.stringify({
          items: [
            {
              title: "Ambition",
              path: "/Essays/Ambition.md",
              publicUrl: "https://alex.substack.com/p/ambition",
              why: "Same argument.",
            },
          ],
        }),
      ),
    ).toEqual([
      {
        title: "Ambition",
        path: "/Essays/Ambition.md",
        notionUrl: "",
        publicUrl: "https://alex.substack.com/p/ambition",
        why: "Same argument.",
      },
    ]);
  });

  it("builds a short excerpt from markdown", () => {
    expect(excerptFromMarkdown("# Hello\n\nA **claim** about work.", 80)).toBe(
      "Hello A claim about work.",
    );
  });
});

describe("titleMatch", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeEssayTitle("Ambition Won't Tell You Where to Go!")).toBe(
      "ambition wont tell you where to go",
    );
  });

  it("matches equal or containing titles", () => {
    expect(titlesMatch("Ambition Won't Tell You Where to Go", "ambition wont tell you where to go")).toBe(
      true,
    );
    expect(
      titlesMatch("Ambition Won't Tell You Where to Go", "Ambition Won't Tell You Where to Go — notes"),
    ).toBe(true);
    expect(titlesMatch("Short", "Shorter")).toBe(false);
    expect(titlesMatch("Unrelated essay title here", "Something else entirely")).toBe(false);
  });
});
