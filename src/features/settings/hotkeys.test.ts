import { describe, expect, it } from "vitest";
import {
  formatHotkeyChord,
  formatHotkeyKeys,
  matchEditMarksHotkey,
  matchFocusModeHotkey,
  matchRevealChromeHotkey,
  matchSettingsHotkey,
  matchSidebarToggleHotkey,
  matchViewHotkey,
} from "./hotkeys";

describe("formatHotkeyKeys", () => {
  it("uses option and arrow symbols on macOS", () => {
    expect(formatHotkeyKeys(["Option", "ArrowLeft"], true)).toEqual(["⌥", "←"]);
    expect(formatHotkeyKeys(["Option", "ArrowDown"], true)).toEqual(["⌥", "↓"]);
  });

  it("uses Alt plus arrows on other platforms", () => {
    expect(formatHotkeyKeys(["Option", "ArrowRight"], false)).toEqual(["Alt", "→"]);
  });
});

describe("formatHotkeyChord", () => {
  it("joins tightly on macOS and with plus elsewhere", () => {
    expect(formatHotkeyChord(["Option", "ArrowLeft"], true)).toBe("⌥←");
    expect(formatHotkeyChord(["Option", "ArrowLeft"], false)).toBe("Alt+←");
  });
});

describe("matchSidebarToggleHotkey", () => {
  const optionLeft = {
    key: "ArrowLeft",
    altKey: true,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
  };

  it("maps option arrows to sidebar toggles", () => {
    expect(matchSidebarToggleHotkey(optionLeft)).toBe("left");
    expect(matchSidebarToggleHotkey({ ...optionLeft, key: "ArrowRight" })).toBe("right");
    expect(matchSidebarToggleHotkey({ ...optionLeft, key: "ArrowDown" })).toBe("both");
  });

  it("ignores repeats, extra modifiers, and other keys", () => {
    expect(matchSidebarToggleHotkey({ ...optionLeft, repeat: true })).toBeNull();
    expect(matchSidebarToggleHotkey({ ...optionLeft, shiftKey: true })).toBeNull();
    expect(matchSidebarToggleHotkey({ ...optionLeft, metaKey: true })).toBeNull();
    expect(matchSidebarToggleHotkey({ ...optionLeft, altKey: false })).toBeNull();
    expect(matchSidebarToggleHotkey({ ...optionLeft, key: "ArrowUp" })).toBeNull();
  });
});

describe("matchViewHotkey", () => {
  const cmdN = {
    key: "n",
    altKey: false,
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
  };

  it("maps command keys to Notes, Write, and Research", () => {
    expect(matchViewHotkey(cmdN)).toBe("notes");
    expect(matchViewHotkey({ ...cmdN, key: "w" })).toBe("write");
    expect(matchViewHotkey({ ...cmdN, key: "r" })).toBe("research");
    expect(matchViewHotkey({ ...cmdN, metaKey: false, ctrlKey: true, key: "n" })).toBe("notes");
  });

  it("ignores repeats, extra modifiers, and other keys", () => {
    expect(matchViewHotkey({ ...cmdN, repeat: true })).toBeNull();
    expect(matchViewHotkey({ ...cmdN, shiftKey: true })).toBeNull();
    expect(matchViewHotkey({ ...cmdN, altKey: true })).toBeNull();
    expect(matchViewHotkey({ ...cmdN, metaKey: false })).toBeNull();
    expect(matchViewHotkey({ ...cmdN, key: "s" })).toBeNull();
  });
});

describe("matchEditMarksHotkey", () => {
  const cmdE = {
    key: "e",
    altKey: false,
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
  };

  it("matches command or control E", () => {
    expect(matchEditMarksHotkey(cmdE)).toBe(true);
    expect(matchEditMarksHotkey({ ...cmdE, key: "E", metaKey: false, ctrlKey: true })).toBe(true);
  });

  it("ignores repeats, extra modifiers, and other keys", () => {
    expect(matchEditMarksHotkey({ ...cmdE, repeat: true })).toBe(false);
    expect(matchEditMarksHotkey({ ...cmdE, shiftKey: true })).toBe(false);
    expect(matchEditMarksHotkey({ ...cmdE, altKey: true })).toBe(false);
    expect(matchEditMarksHotkey({ ...cmdE, metaKey: false })).toBe(false);
    expect(matchEditMarksHotkey({ ...cmdE, key: "f" })).toBe(false);
  });
});

describe("chrome hotkeys", () => {
  it("matches option up, option f, and command comma", () => {
    expect(
      matchRevealChromeHotkey({
        key: "ArrowUp",
        altKey: true,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBe(true);
    expect(
      matchFocusModeHotkey({
        key: "ƒ",
        code: "KeyF",
        altKey: true,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBe(true);
    expect(
      matchSettingsHotkey({
        key: ",",
        code: "Comma",
        altKey: false,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBe(true);
  });

  it("ignores extra modifiers", () => {
    expect(
      matchRevealChromeHotkey({
        key: "ArrowUp",
        altKey: true,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBe(false);
    expect(
      matchFocusModeHotkey({
        key: "f",
        code: "KeyF",
        altKey: true,
        metaKey: false,
        ctrlKey: false,
        shiftKey: true,
      }),
    ).toBe(false);
    expect(
      matchSettingsHotkey({
        key: ",",
        altKey: false,
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
      }),
    ).toBe(false);
  });
});
