import { describe, expect, it } from "vitest";
import {
  parseDocumentFrontmatter,
  serializeDocumentWithFrontmatter,
} from "./documentFrontmatter";

const EMPTY_NOTION = {
  notionParentPageId: "",
  notionEssayPageId: "",
  notionRenameParent: false,
};

describe("documentFrontmatter", () => {
  it("returns empty meta when there is no frontmatter", () => {
    const raw = "Hello body\n";
    expect(parseDocumentFrontmatter(raw)).toEqual({
      meta: { postTitle: "", subtitle: "", ...EMPTY_NOTION },
      body: raw,
    });
  });

  it("parses title and subtitle from YAML frontmatter", () => {
    const raw = `---
title: My Post
subtitle: A short dek
---

Body paragraph.
`;
    expect(parseDocumentFrontmatter(raw)).toEqual({
      meta: { postTitle: "My Post", subtitle: "A short dek", ...EMPTY_NOTION },
      body: "Body paragraph.\n",
    });
  });

  it("round-trips title and subtitle", () => {
    const body = "First line.\n";
    const serialized = serializeDocumentWithFrontmatter(body, {
      postTitle: "Hello",
      subtitle: "World",
    });
    expect(serialized).toBe(`---
title: Hello
subtitle: World
---
First line.
`);
    expect(parseDocumentFrontmatter(serialized)).toEqual({
      meta: { postTitle: "Hello", subtitle: "World", ...EMPTY_NOTION },
      body: "First line.\n",
    });
  });

  it("omits frontmatter when both fields are empty", () => {
    expect(serializeDocumentWithFrontmatter("Just body.\n", { postTitle: "", subtitle: "" })).toBe(
      "Just body.\n",
    );
  });

  it("round-trips Notion page ids in frontmatter", () => {
    const serialized = serializeDocumentWithFrontmatter("Body.\n", {
      postTitle: "Ambition",
      notionParentPageId: "parent-1",
      notionEssayPageId: "essay-2",
      notionRenameParent: true,
    });
    expect(serialized).toBe(`---
title: Ambition
notion_page: parent-1
notion_essay: essay-2
notion_created: true
---
Body.
`);
    expect(parseDocumentFrontmatter(serialized).meta).toEqual({
      postTitle: "Ambition",
      subtitle: "",
      notionParentPageId: "parent-1",
      notionEssayPageId: "essay-2",
      notionRenameParent: true,
    });
  });

  it("keeps a parent-only Notion link without a title", () => {
    const serialized = serializeDocumentWithFrontmatter("", {
      notionParentPageId: "idea-card",
    });
    expect(serialized).toContain("notion_page: idea-card");
    expect(parseDocumentFrontmatter(serialized).meta.notionParentPageId).toBe("idea-card");
  });
});
