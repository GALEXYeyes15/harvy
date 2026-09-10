import { afterEach, describe, expect, it } from "vitest";
import type { CollectItem } from "../collect/collectItems";
import {
  dismissNotionIdeaPage,
  mergeNotionIdeasIntoCollectItems,
  notionPageToCollectItem,
  todayLocalIsoDate,
} from "./notionIdeas";

describe("mergeNotionIdeasIntoCollectItems", () => {
  afterEach(() => {
    localStorage.removeItem("harvy:notion-ideas-dismissed");
  });
  it("replaces the list with Notion pages and drops local-only rows", () => {
    const local: CollectItem = {
      id: "local-1",
      preview: "Local only",
      dateCreated: "2026-01-01",
    };
    const existingSynced: CollectItem = {
      id: "notion:abc",
      preview: "Old title",
      dateCreated: "2026-01-02",
      body: "old",
      notionPageId: "abc",
      status: "Idea",
    };
    const startedGone: CollectItem = {
      id: "notion:gone",
      preview: "Started elsewhere",
      dateCreated: "2026-01-03",
      notionPageId: "gone",
      status: "Idea",
    };

    const merged = mergeNotionIdeasIntoCollectItems(
      [local, existingSynced, startedGone],
      [
        {
          pageId: "abc",
          title: "New title",
          notes: "fresh notes",
          status: "Idea",
          createdTime: "2026-02-01T00:00:00.000Z",
        },
        {
          pageId: "new",
          title: "Brand new",
          notes: "",
          status: "Idea",
          createdTime: "2026-02-02T00:00:00.000Z",
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((i) => i.notionPageId === "abc")?.preview).toBe("New title");
    expect(merged.find((i) => i.notionPageId === "abc")?.body).toBe("fresh notes");
    expect(merged.find((i) => i.notionPageId === "gone")).toBeUndefined();
    expect(merged.find((i) => i.id === "local-1")).toBeUndefined();
    expect(merged.find((i) => i.notionPageId === "new")?.preview).toBe("Brand new");
  });

  it("maps Notion pages to collect items", () => {
    const item = notionPageToCollectItem({
      pageId: "p1",
      title: " Essay ",
      notes: " notes ",
      status: "Idea",
      createdTime: "2026-03-10T12:00:00.000Z",
    });
    expect(item.notionPageId).toBe("p1");
    expect(item.preview).toBe("Essay");
    expect(item.body).toBe("notes");
    expect(item.status).toBe("Idea");
    expect(item.dateCreated).toBe("2026-03-10");
  });

  it("omits dismissed Notion pages on merge", () => {
    localStorage.setItem("harvy:notion-ideas-dismissed", JSON.stringify(["abc"]));
    dismissNotionIdeaPage("new");

    const merged = mergeNotionIdeasIntoCollectItems(
      [],
      [
        {
          pageId: "abc",
          title: "Gone",
          notes: "",
          status: "Idea",
          createdTime: "2026-02-01T00:00:00.000Z",
        },
        {
          pageId: "keep",
          title: "Keep",
          notes: "",
          status: "Idea",
          createdTime: "2026-02-02T00:00:00.000Z",
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.notionPageId).toBe("keep");
  });
});

describe("todayLocalIsoDate", () => {
  it("formats the local calendar day as YYYY-MM-DD", () => {
    expect(todayLocalIsoDate(new Date(2026, 8, 10, 23, 45))).toBe("2026-09-10");
  });
});
