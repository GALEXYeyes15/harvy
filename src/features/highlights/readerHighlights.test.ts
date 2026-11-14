import { describe, expect, it } from "vitest";
import {
  coverPath,
  httpsUrl,
  sharperCoverUrl,
  formatHighlightForNotes,
  groupHighlightsBySource,
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

describe("coverPath", () => {
  it("keeps plain relative image paths and rejects anything else", () => {
    expect(coverPath("books/wolf-brother/cover.jpg")).toBe("books/wolf-brother/cover.jpg");
    expect(coverPath("books\\a\\cover.PNG")).toBe("books/a/cover.PNG");
    expect(coverPath("../secret.jpg")).toBe("");
    expect(coverPath("books/../../x.jpg")).toBe("");
    expect(coverPath("/Users/me/cover.jpg")).toBe("");
    expect(coverPath("C:/cover.jpg")).toBe("");
    expect(coverPath("books/a/meta.json")).toBe("");
    expect(coverPath(42)).toBe("");
  });

  it("gives a book group the first cover among its highlights", () => {
    const raw = JSON.stringify({
      highlights: [
        { id: "1", text: "a", source: { title: "Book", author: "A" } },
        { id: "2", text: "b", source: { title: "Book", author: "A", cover: "books/book/cover.jpg" } },
      ],
    });
    const [group] = groupHighlightsBySource(parseReaderHighlights(raw).highlights);
    expect(group!.cover).toBe("books/book/cover.jpg");
  });
});

describe("cover URLs", () => {
  it("keeps https cover URLs only", () => {
    expect(httpsUrl("https://m.media-amazon.com/images/I/91MOOoO1stL._SY160.jpg")).toBe(
      "https://m.media-amazon.com/images/I/91MOOoO1stL._SY160.jpg",
    );
    expect(httpsUrl("http://example.com/a.jpg")).toBe("");
    expect(httpsUrl("javascript:alert(1)")).toBe("");
    expect(httpsUrl("not a url")).toBe("");
  });

  it("asks Amazon for a sharper cover and leaves other hosts alone", () => {
    expect(sharperCoverUrl("https://m.media-amazon.com/images/I/91MOOoO1stL._SY160.jpg")).toBe(
      "https://m.media-amazon.com/images/I/91MOOoO1stL._SY480_.jpg",
    );
    expect(sharperCoverUrl("https://example.com/cover._SY160.jpg")).toBe(
      "https://example.com/cover._SY160.jpg",
    );
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

describe("groupHighlightsBySource", () => {
  it("groups by book, newest book first, oldest highlight first inside a book", () => {
    const raw = JSON.stringify({
      highlights: [
        { id: "a1", text: "A early", created: "2026-11-01T00:00:00Z", source: { title: "Book A", author: "X" } },
        { id: "b1", text: "B", created: "2026-11-05T00:00:00Z", source: { title: "Book B" } },
        { id: "a2", text: "A late", created: "2026-11-10T00:00:00Z", source: { title: "book a", author: "x" } },
        { id: "s1", text: "Site only", created: "2026-10-01T00:00:00Z", source: { site: "Example" } },
      ],
    });
    const groups = groupHighlightsBySource(parseReaderHighlights(raw).highlights);
    expect(groups.map((g) => [g.title, g.highlights.map((h) => h.id)])).toEqual([
      ["book a", ["a1", "a2"]],
      ["Book B", ["b1"]],
      ["Example", ["s1"]],
    ]);
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
