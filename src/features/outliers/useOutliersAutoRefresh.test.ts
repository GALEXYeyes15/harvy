import { describe, expect, it } from "vitest";
import { msUntilNextOutliersRefresh } from "./useOutliersAutoRefresh";

describe("msUntilNextOutliersRefresh", () => {
  const intervalMs = 5 * 60_000;

  it("fetches immediately when there is no prior fetch", () => {
    expect(msUntilNextOutliersRefresh(null, intervalMs, 1_000_000)).toBe(0);
    expect(msUntilNextOutliersRefresh(undefined, intervalMs, 1_000_000)).toBe(0);
  });

  it("waits the remaining interval after a recent fetch", () => {
    const now = 1_000_000;
    const fetchedAt = now - 2 * 60_000;
    expect(msUntilNextOutliersRefresh(fetchedAt, intervalMs, now)).toBe(3 * 60_000);
  });

  it("fetches immediately when the interval has already elapsed", () => {
    const now = 1_000_000;
    const fetchedAt = now - 10 * 60_000;
    expect(msUntilNextOutliersRefresh(fetchedAt, intervalMs, now)).toBe(0);
  });
});
