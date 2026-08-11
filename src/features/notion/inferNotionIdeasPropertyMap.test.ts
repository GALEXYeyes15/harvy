import { describe, expect, it } from "vitest";
import { inferNotionIdeasPropertyMap } from "../../features/notion/notionIdeas";

describe("inferNotionIdeasPropertyMap", () => {
  it("picks title, status, and notes properties", () => {
    const map = inferNotionIdeasPropertyMap([
      { name: "Name", propertyType: "title" },
      { name: "Status", propertyType: "select" },
      { name: "Notes", propertyType: "rich_text" },
      { name: "Publish Date", propertyType: "date" },
    ]);
    expect(map).toEqual({
      titleProperty: "Name",
      notesProperty: "Notes",
      statusProperty: "Status",
    });
  });

  it("prefers status type over select", () => {
    const map = inferNotionIdeasPropertyMap([
      { name: "Name", propertyType: "title" },
      { name: "Tag", propertyType: "select" },
      { name: "Status", propertyType: "status" },
    ]);
    expect(map.statusProperty).toBe("Status");
  });
});
