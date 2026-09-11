import { describe, expect, it } from "vitest";
import {
  COLLECT_SUB_VIEWS,
  enabledCollectViews,
  firstEnabledCollectView,
  moveCollectView,
  normalizeCollectViewOrder,
} from "./collectViews";

const allOn = {
  showOutliersView: true,
  showCollectView: true,
  showHeadlinesView: true,
  showAvatarView: true,
};

describe("normalizeCollectViewOrder", () => {
  it("returns the default order for empty or invalid input", () => {
    expect(normalizeCollectViewOrder(undefined)).toEqual(COLLECT_SUB_VIEWS);
    expect(normalizeCollectViewOrder(["nope", 1])).toEqual(COLLECT_SUB_VIEWS);
  });

  it("keeps a custom order and appends missing views", () => {
    expect(normalizeCollectViewOrder(["avatar", "outliers"])).toEqual([
      "avatar",
      "outliers",
      "collect",
      "headlines",
    ]);
  });

  it("drops duplicates", () => {
    expect(normalizeCollectViewOrder(["headlines", "headlines", "ideas"])).toEqual([
      "headlines",
      "outliers",
      "collect",
      "avatar",
    ]);
  });
});

describe("moveCollectView", () => {
  it("moves a view to a new index", () => {
    expect(moveCollectView(COLLECT_SUB_VIEWS, 0, 2)).toEqual([
      "collect",
      "headlines",
      "outliers",
      "avatar",
    ]);
    expect(moveCollectView(COLLECT_SUB_VIEWS, 3, 0)).toEqual([
      "avatar",
      "outliers",
      "collect",
      "headlines",
    ]);
  });

  it("ignores out-of-range indexes", () => {
    expect(moveCollectView(COLLECT_SUB_VIEWS, -1, 1)).toEqual(COLLECT_SUB_VIEWS);
    expect(moveCollectView(COLLECT_SUB_VIEWS, 0, 9)).toEqual(COLLECT_SUB_VIEWS);
  });
});

describe("enabledCollectViews", () => {
  it("filters and respects order", () => {
    expect(
      enabledCollectViews(
        { ...allOn, showCollectView: false },
        ["avatar", "collect", "outliers", "headlines"],
      ),
    ).toEqual(["avatar", "outliers", "headlines"]);
  });
});

describe("firstEnabledCollectView", () => {
  it("returns the first enabled view in order", () => {
    expect(firstEnabledCollectView(allOn)).toBe("outliers");
    expect(
      firstEnabledCollectView(
        { ...allOn, showOutliersView: false },
        ["avatar", "outliers", "collect", "headlines"],
      ),
    ).toBe("avatar");
  });
});
