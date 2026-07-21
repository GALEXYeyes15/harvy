import { describe, expect, it } from "vitest";
import {
  parseDocumentFrontmatter,
  serializeDocumentWithFrontmatter,
} from "./documentFrontmatter";

describe("documentFrontmatter", () => {
  it("returns empty meta when there is no frontmatter", () => {
    const raw = "Hello body\n";
    expect(parseDocumentFrontmatter(raw)).toEqual({
      meta: { postTitle: "", subtitle: "" },
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
      meta: { postTitle: "My Post", subtitle: "A short dek" },
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
      meta: { postTitle: "Hello", subtitle: "World" },
      body: "First line.\n",
    });
  });

  it("omits frontmatter when both fields are empty", () => {
    expect(serializeDocumentWithFrontmatter("Just body.\n", { postTitle: "", subtitle: "" })).toBe(
      "Just body.\n",
    );
  });
});
