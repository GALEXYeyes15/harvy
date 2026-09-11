import { describe, expect, it } from "vitest";
import {
  documentNotionSidecarPath,
  mergeNotionEssayLink,
  notionFieldsFromLink,
  notionLinkFromFields,
  parseNotionEssayLink,
} from "./notionEssaySync";

describe("notionEssaySync", () => {
  it("builds a sidecar path next to the markdown file", () => {
    expect(documentNotionSidecarPath("/essays/Hello.md")).toBe(
      "/essays/Hello.md.harvy-notion.json",
    );
  });

  it("parses a saved Notion essay link", () => {
    expect(
      parseNotionEssayLink(
        JSON.stringify({
          parentPageId: "parent-1",
          essayPageId: "essay-2",
          renameParent: true,
        }),
      ),
    ).toEqual({
      parentPageId: "parent-1",
      essayPageId: "essay-2",
      renameParent: true,
      parentUrl: "",
      essayUrl: "",
      publicUrl: "",
    });
  });

  it("keeps a parent-only link from Start writing", () => {
    expect(
      parseNotionEssayLink(
        JSON.stringify({
          parentPageId: "idea-card",
          essayPageId: "",
          renameParent: false,
        }),
      ),
    ).toEqual({
      parentPageId: "idea-card",
      essayPageId: "",
      renameParent: false,
      parentUrl: "",
      essayUrl: "",
      publicUrl: "",
    });
  });

  it("returns null for empty or invalid payloads", () => {
    expect(parseNotionEssayLink("{}")).toBeNull();
    expect(parseNotionEssayLink("not-json")).toBeNull();
  });

  it("round-trips Notion ids on the document", () => {
    const link = notionLinkFromFields({
      notionParentPageId: "parent-1",
      notionEssayPageId: "essay-2",
      notionRenameParent: true,
    });
    expect(link).toEqual({
      parentPageId: "parent-1",
      essayPageId: "essay-2",
      renameParent: true,
      parentUrl: "",
      essayUrl: "",
      publicUrl: "",
    });
    expect(notionFieldsFromLink(link)).toEqual({
      notionParentPageId: "parent-1",
      notionEssayPageId: "essay-2",
      notionRenameParent: true,
      notionParentUrl: "",
      notionEssayUrl: "",
      publicUrl: "",
    });
    expect(notionLinkFromFields({})).toBeNull();
  });

  it("merges missing URLs from a sidecar fallback", () => {
    expect(
      mergeNotionEssayLink(
        {
          parentPageId: "parent-1",
          essayPageId: "essay-2",
          renameParent: true,
          parentUrl: "",
          essayUrl: "",
          publicUrl: "",
        },
        {
          parentPageId: "parent-1",
          essayPageId: "essay-2",
          renameParent: false,
          parentUrl: "https://www.notion.so/parent",
          essayUrl: "https://www.notion.so/essay",
          publicUrl: "https://alex.substack.com/p/hello",
        },
      ),
    ).toEqual({
      parentPageId: "parent-1",
      essayPageId: "essay-2",
      renameParent: true,
      parentUrl: "https://www.notion.so/parent",
      essayUrl: "https://www.notion.so/essay",
      publicUrl: "https://alex.substack.com/p/hello",
    });
  });
});
