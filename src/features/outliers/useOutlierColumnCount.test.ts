import { describe, expect, it } from "vitest";
import {
  columnCountSettleDelayMs,
  columnsFromSidebars,
  OUTLIER_SIDEBAR_TRANSITION_MS,
} from "./useOutlierColumnCount";

describe("columnsFromSidebars", () => {
  it("returns 3 when both sidebars are open", () => {
    expect(columnsFromSidebars(true, true)).toBe(3);
  });

  it("returns 4 when only one sidebar is open", () => {
    expect(columnsFromSidebars(true, false)).toBe(4);
    expect(columnsFromSidebars(false, true)).toBe(4);
  });

  it("returns 5 when both sidebars are closed", () => {
    expect(columnsFromSidebars(false, false)).toBe(5);
  });
});

describe("columnCountSettleDelayMs", () => {
  it("returns 0 when the count is unchanged", () => {
    expect(columnCountSettleDelayMs(4, 4)).toBe(0);
  });

  it("settles sooner when dropping a column", () => {
    const drop = columnCountSettleDelayMs(4, 3);
    const add = columnCountSettleDelayMs(3, 4);
    expect(drop).toBeLessThan(add);
    expect(drop).toBeLessThan(OUTLIER_SIDEBAR_TRANSITION_MS * 0.25);
  });

  it("waits longer when adding a column", () => {
    expect(columnCountSettleDelayMs(3, 4)).toBeGreaterThan(
      OUTLIER_SIDEBAR_TRANSITION_MS * 0.4,
    );
  });
});
