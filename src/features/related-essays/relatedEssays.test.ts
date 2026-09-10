import { describe, expect, it } from "vitest";
import {
  collectEssayMarkdownFiles,
  excerptFromMarkdown,
  isEssayMarkdownFileName,
  parseRelatedEssayItems,
  parseRelatedEssaySidecar,
  preferredRelatedUrl,
} from "./relatedEssays";
import {
  locateRelatedPhrasesInText,
  MAX_RELATED_LINKS,
  relatedIssuesAfterLinking,
  uniqueLinkedRelatedPaths,
} from "./relatedPhrases";
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
        phrase: "",
      },
    ]);
  });

  it("builds a short excerpt from markdown", () => {
    expect(excerptFromMarkdown("# Hello\n\nA **claim** about work.", 80)).toBe(
      "Hello A claim about work.",
    );
  });

  it("parses linked paths and phrases from a sidecar", () => {
    expect(
      parseRelatedEssaySidecar(
        JSON.stringify({
          items: [
            {
              title: "Ambition",
              path: "/Essays/Ambition.md",
              phrase: "rest will not save you",
              why: "Same argument.",
            },
          ],
          linkedPaths: [" /Essays/Other.md ", "/Essays/Other.md"],
        }),
      ),
    ).toEqual({
      items: [
        {
          title: "Ambition",
          path: "/Essays/Ambition.md",
          notionUrl: "",
          publicUrl: "",
          why: "Same argument.",
          phrase: "rest will not save you",
        },
      ],
      linkedPaths: ["/Essays/Other.md"],
    });
  });

  it("locates verbatim related phrases in the draft", () => {
    const issues = locateRelatedPhrasesInText("Rest will not save you from burnout.", [
      {
        title: "Why Rest Won't Fix Overwhelm",
        path: "/Essays/rest.md",
        publicUrl: "https://alex.substack.com/p/rest",
        why: "Same claim about rest.",
        phrase: "Rest will not save you",
      },
    ]);
    expect(issues).toEqual([
      {
        type: "related",
        text: "Rest will not save you",
        message: "Same claim about rest.",
        start: 0,
        end: 22,
        relatedPath: "/Essays/rest.md",
        relatedUrl: "https://alex.substack.com/p/rest",
        relatedTitle: "Why Rest Won't Fix Overwhelm",
      },
    ]);
  });

  it("counts unique linked essays from sidecar paths and matching hrefs", () => {
    const linked = uniqueLinkedRelatedPaths({
      linkedPaths: ["/Essays/a.md"],
      items: [
        {
          title: "A",
          path: "/Essays/a.md",
          publicUrl: "https://alex.substack.com/p/a/",
        },
        {
          title: "B",
          path: "/Essays/b.md",
          notionUrl: "https://www.notion.so/b",
        },
      ],
      hrefs: ["https://www.notion.so/b"],
    });
    expect(linked).toEqual(["/Essays/a.md", "/Essays/b.md"]);
    expect(linked.length).toBe(MAX_RELATED_LINKS);
  });

  it("clears leftover related underlines after two essays are linked", () => {
    const issues = locateRelatedPhrasesInText(
      "Coping is not hoping, and rest will not save you.",
      [
        {
          title: "Coping",
          path: "/Essays/coping.md",
          why: "Names the distinction.",
          phrase: "Coping is not hoping",
        },
        {
          title: "Rest",
          path: "/Essays/rest.md",
          why: "Same rest claim.",
          phrase: "rest will not save you",
        },
      ],
    );
    const afterFirst = relatedIssuesAfterLinking(issues, [], "/Essays/coping.md");
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]?.relatedPath).toBe("/Essays/rest.md");
    expect(relatedIssuesAfterLinking(afterFirst, ["/Essays/coping.md"], "/Essays/rest.md")).toEqual(
      [],
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
