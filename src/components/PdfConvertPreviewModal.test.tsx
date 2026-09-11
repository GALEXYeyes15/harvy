import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PdfConvertPreviewModal } from "./PdfConvertPreviewModal";

const previewProps = {
  sourceName: "Notes.pdf",
  sourcePath: "/workspace/Notes.pdf",
  workspaceRootPath: "/workspace",
  onClose: () => {},
  onConvert: () => {},
};

describe("PdfConvertPreviewModal", () => {
  it("shows the PDF file and converts it", async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();
    const onClose = vi.fn();

    render(
      <PdfConvertPreviewModal
        open
        {...previewProps}
        markdown={"Hello  \nworld.\n"}
        loading={false}
        error={null}
        submitting={false}
        onClose={onClose}
        onConvert={onConvert}
      />,
    );

    expect(screen.getByRole("heading", { name: "Convert to Markdown" })).toBeInTheDocument();
    expect(screen.getByText("Notes.pdf")).toBeInTheDocument();
    expect(screen.getByTitle("Notes.pdf")).toHaveAttribute("src", "/workspace/Notes.pdf");
    expect(screen.queryByText(/Hello/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(onConvert).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the PDF while conversion text is still loading", () => {
    render(
      <PdfConvertPreviewModal
        open
        {...previewProps}
        markdown={null}
        loading
        error={null}
        submitting={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Convert" })).toBeDisabled();
    expect(screen.getByTitle("Notes.pdf")).toBeInTheDocument();
  });

  it("keeps the PDF visible when extraction fails", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <PdfConvertPreviewModal
        open
        {...previewProps}
        markdown={null}
        loading={false}
        error="Could not open this PDF."
        submitting={false}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("button", { name: "Convert" })).toBeDisabled();
    expect(screen.getByTitle("Notes.pdf")).toBeInTheDocument();
    expect(screen.getByText("Could not open this PDF.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
