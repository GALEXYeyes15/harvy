import { afterEach, describe, expect, it } from "vitest";
import { readFocusVisibilityPrefs, writeFocusVisibilityPrefs } from "./focusVisibilitySettings";

afterEach(() => {
  localStorage.clear();
});

describe("focus visibility prefs", () => {
  it("hides the focus and edit buttons while typing unless opted in", () => {
    expect(readFocusVisibilityPrefs().keepFocusEditVisibleWhileTyping).toBe(false);

    writeFocusVisibilityPrefs({ keepFocusEditVisibleWhileTyping: true });
    expect(readFocusVisibilityPrefs().keepFocusEditVisibleWhileTyping).toBe(true);

    writeFocusVisibilityPrefs({ keepFocusEditVisibleWhileTyping: false });
    expect(readFocusVisibilityPrefs().keepFocusEditVisibleWhileTyping).toBe(false);
  });
});
