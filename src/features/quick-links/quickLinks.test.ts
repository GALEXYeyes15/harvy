import { describe, expect, it } from "vitest";
import {
  createQuickLink,
  displayHostFromUrl,
  normalizeQuickLink,
  normalizeQuickLinkUrl,
  parsePersistedQuickLinks,
} from "./quickLinks";

describe("normalizeQuickLinkUrl", () => {
  it("accepts https urls", () => {
    expect(normalizeQuickLinkUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("adds https to bare domains", () => {
    expect(normalizeQuickLinkUrl("example.com")).toBe("https://example.com/");
  });

  it("rejects unsafe protocols", () => {
    expect(normalizeQuickLinkUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("normalizeQuickLink", () => {
  it("falls back to hostname when title is empty", () => {
    const link = normalizeQuickLink(
      createQuickLink({ title: "  ", url: "https://www.example.com/a" }),
    );
    expect(link.title).toBe("example.com");
    expect(link.url).toBe("https://www.example.com/a");
  });
});

describe("displayHostFromUrl", () => {
  it("strips www", () => {
    expect(displayHostFromUrl("https://www.example.com/x")).toBe("example.com");
  });
});

describe("parsePersistedQuickLinks", () => {
  it("keeps valid rows and drops invalid ones", () => {
    const links = parsePersistedQuickLinks([
      { id: "1", title: "Docs", url: "https://docs.example.com" },
      { id: "2", title: "Bad", url: "javascript:nope" },
      { title: "Missing id", url: "https://example.com" },
    ]);
    expect(links).toHaveLength(1);
    expect(links[0]?.title).toBe("Docs");
  });
});
