import { describe, expect, it } from "vitest";
import { finderNameToPosixSegment, posixSegmentToFinderName } from "./finderFileNames";

describe("posixSegmentToFinderName", () => {
  it("shows POSIX colons as slashes on macOS", () => {
    expect(posixSegmentToFinderName("6:14-6:20", true)).toBe("6/14-6/20");
    expect(posixSegmentToFinderName("June 2026", true)).toBe("June 2026");
  });

  it("leaves names unchanged on other platforms", () => {
    expect(posixSegmentToFinderName("6:14-6:20", false)).toBe("6:14-6:20");
  });
});

describe("finderNameToPosixSegment", () => {
  it("stores Finder slashes as colons on macOS", () => {
    expect(finderNameToPosixSegment("6/14-6/20", true)).toBe("6:14-6:20");
  });

  it("round-trips with display conversion on macOS", () => {
    const posix = "6:28-7:4";
    expect(finderNameToPosixSegment(posixSegmentToFinderName(posix, true), true)).toBe(posix);
  });
});
