import { describe, expect, it } from "vitest";
import { editorHtmlToMarkdown } from "../editor/documentMarkdown";
import { pageBreakBlockIndexes, presentationNotesPageHeightPx } from "./presentationNotesPages";

describe("presentationNotesPageHeightPx", () => {
  it("scales an A4 content page to the preview line height", () => {
    const height = presentationNotesPageHeightPx(27.2);
    expect(height).toBeGreaterThan(1100);
    expect(height).toBeLessThan(1300);
  });
});

describe("pageBreakBlockIndexes", () => {
  const page = 100;

  it("keeps a short document on one page", () => {
    expect(
      pageBreakBlockIndexes(
        [
          { top: 0, bottom: 20 },
          { top: 28, bottom: 48 },
        ],
        page,
      ),
    ).toEqual([]);
  });

  it("starts a new page before a block that would cross the boundary", () => {
    expect(
      pageBreakBlockIndexes(
        [
          { top: 0, bottom: 40 },
          { top: 48, bottom: 70 },
          { top: 80, bottom: 130 },
          { top: 140, bottom: 160 },
        ],
        page,
      ),
    ).toEqual([2]);
  });

  it("continues onto later pages from the new page start", () => {
    expect(
      pageBreakBlockIndexes(
        [
          { top: 0, bottom: 40 },
          { top: 90, bottom: 120 },
          { top: 200, bottom: 230 },
        ],
        page,
      ),
    ).toEqual([1, 2]);
  });

  it("leaves page-gap marks out of the saved markdown", () => {
    const markdown = editorHtmlToMarkdown(
      '<h2 data-page-gap="">Title</h2><ul><li data-page-gap="">Bullet</li></ul>',
    );
    expect(markdown).toContain("## Title");
    expect(markdown).toContain("Bullet");
    expect(markdown).not.toContain("page-gap");
  });

  it("lets a block taller than a page occupy its own page", () => {
    expect(
      pageBreakBlockIndexes(
        [
          { top: 0, bottom: 180 },
          { top: 190, bottom: 210 },
        ],
        page,
      ),
    ).toEqual([1]);
  });
});
