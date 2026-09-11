import { describe, expect, it } from "vitest";
import {
  collectEssayMarkdownFiles,
  excerptFromMarkdown,
  isEssayMarkdownFileName,
  parseRelatedEssayItems,
  parseRelatedEssaySidecar,
  preferredRelatedUrl,
  relatedUrlsFromSources,
  notionUrlFromPageId,
} from "./relatedEssays";
import {
  locateRelatedPhrasesInText,
  MAX_RELATED_LINKS,
  relatedIssuesAfterLinking,
  uniqueLinkedRelatedPaths,
} from "./relatedPhrases";
import { guessSubstackPostUrl, normalizeEssayTitle, titlesMatch } from "./titleMatch";

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

  it("builds a Notion URL from a stored page id", () => {
    expect(notionUrlFromPageId("01234567-89ab-cdef-0123-456789abcdef")).toBe(
      "https://www.notion.so/0123456789abcdef0123456789abcdef",
    );
    expect(notionUrlFromPageId("not-an-id")).toBe("");
  });

  it("falls back to a Notion page id when URL fields are empty", () => {
    expect(
      relatedUrlsFromSources({
        notionEssayPageId: "01234567-89ab-cdef-0123-456789abcdef",
      }),
    ).toEqual({
      publicUrl: "",
      notionUrl: "https://www.notion.so/0123456789abcdef0123456789abcdef",
    });
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

  it("locates a related phrase and underlines its full sentence", () => {
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
        text: "Rest will not save you from burnout.",
        message: "Same claim about rest.",
        start: 0,
        end: 36,
        relatedPath: "/Essays/rest.md",
        relatedUrl: "https://alex.substack.com/p/rest",
        relatedTitle: "Why Rest Won't Fix Overwhelm",
      },
    ]);
  });

  it("clamps a multi-sentence phrase to the first sentence only", () => {
    const essay = "Rest will not save you. Coping is not hoping.";
    const issues = locateRelatedPhrasesInText(essay, [
      {
        title: "Rest",
        path: "/Essays/rest.md",
        why: "Same rest claim.",
        phrase: "Rest will not save you. Coping is not hoping.",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.text).toBe("Rest will not save you.");
    expect(issues[0]?.start).toBe(0);
    expect(issues[0]?.end).toBe("Rest will not save you.".length);
  });

  it("underlines a sentence at most once", () => {
    const issues = locateRelatedPhrasesInText("Rest will not save you from burnout.", [
      {
        title: "Rest",
        path: "/Essays/rest.md",
        why: "Same rest claim.",
        phrase: "Rest will not save you",
      },
      {
        title: "Burnout",
        path: "/Essays/burnout.md",
        why: "Also burnout.",
        phrase: "save you from burnout",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.relatedPath).toBe("/Essays/rest.md");
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
      "Coping is not hoping. And rest will not save you.",
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
    expect(issues).toHaveLength(2);
    const afterFirst = relatedIssuesAfterLinking(issues, [], "/Essays/coping.md");
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]?.relatedPath).toBe("/Essays/rest.md");
    expect(relatedIssuesAfterLinking(afterFirst, ["/Essays/coping.md"], "/Essays/rest.md")).toEqual(
      [],
    );
  });

  it("drops the linked phrase even when the related path is missing", () => {
    const issues = locateRelatedPhrasesInText("Coping is not hoping, and rest will not save you.", [
      {
        title: "Coping",
        path: "/Essays/coping.md",
        why: "Names the distinction.",
        phrase: "Coping is not hoping",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(
      relatedIssuesAfterLinking(issues, [], { start: issues[0]!.start, end: issues[0]!.end }),
    ).toEqual([]);
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

  it("guesses a Substack post URL from the archive and title", () => {
    expect(
      guessSubstackPostUrl(
        "https://alex.substack.com",
        "Why Rest Won't Fix Your Overwhelm",
      ),
    ).toBe("https://alex.substack.com/p/why-rest-wont-fix-your-overwhelm");
  });
});
