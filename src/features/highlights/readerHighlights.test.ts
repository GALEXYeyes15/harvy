import { describe, expect, it } from "vitest";
import {
  formatHighlightForNotes,
  highlightMatchesQuery,
  parseReaderHighlights,
} from "./readerHighlights";

const sample = JSON.stringify({
  version: 1,
  updatedAt: "2026-11-13T19:45:00.000Z",
  extra: "ignored",
  highlights: [
    {
      id: "h_old",
      text: "  Older quote.  ",
      note: "",
      chapter: "p. 12",
      created: "2026-10-01T00:00:00.000Z",
      color: "green",
      tags: ["focus", "focus", "", 3],
      source: { kind: "pdf", title: "Deep Work", author: "Cal Newport", year: 2016 },
    },
    { id: "h_blank", text: "   ", source: { title: "Nope" } },
    { id: "h_trashed", text: "Deleted in Reader.", deletedAt: "2026-11-14T01:36:55.971Z" },
    "not an object",
    {
      id: "h_new",
      text: "The quote.",
      note: "What I thought.",
      chapter: "Chapter 3",
      created: "2026-11-12T00:00:00.000Z",
      color: "purple",
      favorite: true,
      unknown: { nested: true },
      source: { kind: "article", title: "An Essay", site: "Example", url: "https://example.com/a" },
    },
    { id: "h_new", text: "Duplicate id." },
    { text: "No id, no date, no source." },
  ],
});

describe("parseReaderHighlights", () => {
  it("normalizes, skips empty entries, dedupes, and sorts newest first", () => {
    const index = parseReaderHighlights(sample);
    expect(index.updatedAt).toBe(Date.parse("2026-11-13T19:45:00.000Z"));
    expect(index.highlights.map((h) => h.id)).toEqual([
      "h_new",
      "h_old",
      expect.any(String),
    ]);

    const [newest, older, undated] = index.highlights;
    expect(newest!.color).toBe("yellow");
    expect(newest!.favorite).toBe(true);
    expect(newest!.source.kind).toBe("article");
    expect(older!.text).toBe("Older quote.");
    expect(older!.tags).toEqual(["focus"]);
    expect(older!.source.year).toBe(2016);
    expect(undated!.created).toBeNull();
    expect(undated!.source.title).toBe("");
  });

  it("tolerates empty or wrong-shaped files and throws on invalid JSON", () => {
    expect(parseReaderHighlights(null).highlights).toEqual([]);
    expect(parseReaderHighlights("").highlights).toEqual([]);
    expect(parseReaderHighlights("[]").highlights).toEqual([]);
    expect(parseReaderHighlights('{"highlights": "nope"}').highlights).toEqual([]);
    expect(() => parseReaderHighlights("{")).toThrow();
  });
});

describe("formatHighlightForNotes", () => {
  it("includes the quote, attribution, link, and note", () => {
    const [newest, older] = parseReaderHighlights(sample).highlights;
    expect(formatHighlightForNotes(newest!)).toBe(
      "“The quote.”\n— An Essay · Chapter 3\nhttps://example.com/a\nNote: What I thought.",
    );
    expect(formatHighlightForNotes(older!)).toBe("“Older quote.”\n— Cal Newport, Deep Work · p. 12");
  });
});

describe("highlightMatchesQuery", () => {
  it("matches every term across text, note, source, and tags", () => {
    const [, older] = parseReaderHighlights(sample).highlights;
    expect(highlightMatchesQuery(older!, "")).toBe(true);
    expect(highlightMatchesQuery(older!, "newport #focus")).toBe(true);
    expect(highlightMatchesQuery(older!, "newport attention")).toBe(false);
  });
});
