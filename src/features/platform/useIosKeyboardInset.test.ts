import { describe, expect, it } from "vitest";
import { keyboardOverlapPx } from "./useIosKeyboardInset";

describe("keyboardOverlapPx", () => {
  it("is zero when the web view already shrunk with the keyboard", () => {
    expect(keyboardOverlapPx(700, 700, 0)).toBe(0);
  });

  it("measures the band the keyboard still covers", () => {
    expect(keyboardOverlapPx(1133, 780, 0)).toBe(353);
  });

  it("ignores a viewport that has scrolled up under the keyboard", () => {
    expect(keyboardOverlapPx(1133, 780, 20)).toBe(333);
  });
});
