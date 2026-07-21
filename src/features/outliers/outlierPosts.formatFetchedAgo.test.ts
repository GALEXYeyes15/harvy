import { describe, expect, it } from "vitest";
import { formatFetchedAgo } from "./outlierPosts";

describe("formatFetchedAgo", () => {
  const now = Date.parse("2026-07-21T12:00:00.000Z");

  it("formats recent and longer spans", () => {
    expect(formatFetchedAgo(now - 10_000, now)).toBe("just now");
    expect(formatFetchedAgo(now - 12 * 60_000, now)).toBe("12 minutes ago");
    expect(formatFetchedAgo(now - 60_000, now)).toBe("1 minute ago");
    expect(formatFetchedAgo(now - 3 * 3_600_000, now)).toBe("3 hours ago");
    expect(formatFetchedAgo(now - 24 * 3_600_000, now)).toBe("1 day ago");
  });
});
