import { describe, expect, it } from "vitest";
import { inferNotionIdeasPropertyMap, statusOptionsFromSchema } from "../../features/notion/notionIdeas";

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

  it("uses a Progress select when Status is missing", () => {
    const map = inferNotionIdeasPropertyMap([
      { name: "Name", propertyType: "title" },
      { name: "Progress", propertyType: "select", options: ["Idea", "Writing"] },
      { name: "Tag", propertyType: "select" },
    ]);
    expect(map.statusProperty).toBe("Progress");
  });

  it("prefers Status over Progress", () => {
    const map = inferNotionIdeasPropertyMap([
      { name: "Name", propertyType: "title" },
      { name: "Progress", propertyType: "select" },
      { name: "Status", propertyType: "status" },
    ]);
    expect(map.statusProperty).toBe("Status");
  });

  it("reads options from the Status property", () => {
    expect(
      statusOptionsFromSchema([
        { name: "Name", propertyType: "title" },
        {
          name: "Status",
          propertyType: "status",
          options: ["Idea", "Writing", "Done"],
        },
      ]),
    ).toEqual(["Idea", "Writing", "Done"]);
  });
});
