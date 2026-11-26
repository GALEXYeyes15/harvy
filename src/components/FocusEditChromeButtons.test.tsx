import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FocusEditChromeButtons } from "./FocusEditChromeButtons";

describe("FocusEditChromeButtons", () => {
  it("starts focus mode and has no edit-highlights button", async () => {
    const user = userEvent.setup();
    const onStartFocus = vi.fn();

    render(<FocusEditChromeButtons onStartFocus={onStartFocus} />);

    await user.click(screen.getByRole("button", { name: "Start focus mode" }));
    expect(onStartFocus).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /edit highlights/i })).toBeNull();
  });
});
