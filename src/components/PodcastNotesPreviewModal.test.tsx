import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PodcastNotesPreviewModal } from "./PodcastNotesPreviewModal";

describe("PodcastNotesPreviewModal", () => {
  it("renders generated notes and exports them", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onClose = vi.fn();
    const onShare = vi.fn();

    render(
      <PodcastNotesPreviewModal
        open
        generating={false}
        error={null}
        markdown={"# Host notes\n\n## Opening\nThe host starts with the hook.\n"}
        onClose={onClose}
        onExport={onExport}
        onShare={onShare}
      />,
    );

    expect(screen.getByRole("heading", { name: "Presentation Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Host notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opening" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("The host starts with the hook.");
    expect(screen.queryByText("Format")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(onShare).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("disables export while notes are generating", () => {
    render(
      <PodcastNotesPreviewModal
        open
        generating
        error={null}
        markdown={null}
        onClose={() => {}}
        onExport={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    expect(screen.getByLabelText("Preparing presentation notes")).toBeInTheDocument();
  });

  it("updates the notes when a bullet is edited", async () => {
    const user = userEvent.setup();
    const onMarkdownChange = vi.fn();

    render(
      <PodcastNotesPreviewModal
        open
        generating={false}
        error={null}
        markdown={"# Host notes\n\n## Opening\n- The host starts with the hook.\n"}
        onClose={() => {}}
        onExport={() => {}}
        onMarkdownChange={onMarkdownChange}
      />,
    );

    const sheet = screen.getByRole("textbox", { name: "Edit presentation notes" });
    await user.click(screen.getByRole("listitem"));
    await user.keyboard("{Control>}a{/Control}A revised point");

    expect(onMarkdownChange).toHaveBeenCalled();
    const last = onMarkdownChange.mock.calls.at(-1)?.[0] as string;
    expect(last).toContain("A revised point");
    expect(sheet).toHaveTextContent("A revised point");
  });
});
