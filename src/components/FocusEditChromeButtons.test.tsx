import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FocusEditChromeButtons } from "./FocusEditChromeButtons";

describe("FocusEditChromeButtons", () => {
  it("starts focus mode and toggles edit highlights", async () => {
    const user = userEvent.setup();
    const onStartFocus = vi.fn();
    const onToggleEditMarks = vi.fn();

    const { rerender } = render(
      <FocusEditChromeButtons
        editMarksOn={false}
        onStartFocus={onStartFocus}
        onToggleEditMarks={onToggleEditMarks}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start focus mode" }));
    expect(onStartFocus).toHaveBeenCalledOnce();

    const editButton = screen.getByRole("button", { name: "Show edit highlights" });
    expect(editButton).toHaveAttribute("aria-pressed", "false");
    await user.click(editButton);
    expect(onToggleEditMarks).toHaveBeenCalledOnce();

    rerender(
      <FocusEditChromeButtons
        editMarksOn
        onStartFocus={onStartFocus}
        onToggleEditMarks={onToggleEditMarks}
      />,
    );
    expect(screen.getByRole("button", { name: "Hide edit highlights" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not toggle edit highlights while the control is disabled", async () => {
    const user = userEvent.setup();
    const onToggleEditMarks = vi.fn();

    render(
      <FocusEditChromeButtons
        editMarksOn={false}
        editMarksDisabled
        onStartFocus={vi.fn()}
        onToggleEditMarks={onToggleEditMarks}
      />,
    );

    const editButton = screen.getByRole("button", { name: "Show edit highlights" });
    expect(editButton).toBeDisabled();
    await user.click(editButton);
    expect(onToggleEditMarks).not.toHaveBeenCalled();
  });
});
