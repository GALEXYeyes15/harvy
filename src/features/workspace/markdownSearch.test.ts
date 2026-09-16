import { describe, expect, it } from "vitest";
import { findCaseInsensitiveRanges, searchHitsToFileNodes } from "./markdownSearch";

describe("searchHitsToFileNodes", () => {
  it("keeps hit counts on file rows", () => {
    expect(
      searchHitsToFileNodes([
        { path: "/Essays/burnout.md", name: "burnout.md", count: 4 },
      ]),
    ).toEqual([
      {
        name: "burnout.md",
        path: "/Essays/burnout.md",
        kind: "file",
        searchHitCount: 4,
      },
    ]);
  });
});

describe("findCaseInsensitiveRanges", () => {
  it("finds every non-overlapping phrase", () => {
    expect(findCaseInsensitiveRanges("Burnout and burnout.", "burnout")).toEqual([
      { start: 0, end: 7 },
      { start: 12, end: 19 },
    ]);
  });

  it("returns nothing for an empty needle", () => {
    expect(findCaseInsensitiveRanges("Burnout", "  ")).toEqual([]);
  });
});

