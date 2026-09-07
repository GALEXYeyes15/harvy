import { describe, expect, it, vi } from "vitest";
import { PRINT_ROOT_ID, buildPrintDocumentHtml, printHtmlDocument } from "./documentPrint";

describe("documentPrint", () => {
  it("prints from the main window, not a popup or iframe", () => {
    const open = vi.spyOn(window, "open");
    const print = vi.spyOn(window, "print").mockImplementation(() => {});

    printHtmlDocument("Host notes", "<h1>Host notes</h1><p>Start with the hook.</p>");

    expect(open).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
    const root = document.getElementById(PRINT_ROOT_ID);
    expect(root).toBeTruthy();
    expect(root?.innerHTML).toContain("Start with the hook.");
    expect(print).toHaveBeenCalledOnce();
    expect(document.title).toBe("Host notes");

    window.dispatchEvent(new Event("afterprint"));
    expect(document.getElementById(PRINT_ROOT_ID)).toBeNull();

    open.mockRestore();
    print.mockRestore();
  });

  it("builds a titled print document", () => {
    const html = buildPrintDocumentHtml("Essay", "<p>Hello</p>");
    expect(html).toContain("<title>Essay</title>");
    expect(html).toContain("<p>Hello</p>");
  });
});
