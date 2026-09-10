import { describe, expect, it } from "vitest";
import {
  documentNotionSidecarPath,
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
    });
    expect(notionFieldsFromLink(link)).toEqual({
      notionParentPageId: "parent-1",
      notionEssayPageId: "essay-2",
      notionRenameParent: true,
    });
    expect(notionLinkFromFields({})).toBeNull();
  });
});
