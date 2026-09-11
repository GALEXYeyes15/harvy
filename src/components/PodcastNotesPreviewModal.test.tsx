import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PodcastNotesPreviewModal } from "./PodcastNotesPreviewModal";

describe("PodcastNotesPreviewModal", () => {
  it("renders generated notes and exports them", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onClose = vi.fn();

    const onPrint = vi.fn();
    const onShare = vi.fn();

    render(
      <PodcastNotesPreviewModal
        open
        generating={false}
        error={null}
        markdown={"# Host notes\n\n## Opening\nThe host starts with the hook.\n"}
        onClose={onClose}
        onExport={onExport}
        onPrint={onPrint}
        onShare={onShare}
      />,
    );

    expect(screen.getByRole("heading", { name: "Podcast Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Host notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opening" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("The host starts with the hook.");

    await user.click(screen.getByRole("button", { name: "Print" }));
    expect(onPrint).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(onShare).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Export PDF" }));
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

    expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled();
    expect(screen.getByLabelText("Preparing podcast notes")).toBeInTheDocument();
  });
});
