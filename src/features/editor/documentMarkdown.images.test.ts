import { describe, expect, it } from "vitest";
import {
  markdownStandardImagesToHarvyFigures,
  markdownToEditorHtml,
  toEditorHtml,
} from "./documentMarkdown";

describe("markdownStandardImagesToHarvyFigures", () => {
  it("converts markdown images whose paths contain spaces", () => {
    const md =
      "![Photo by Luca Bravo on Unsplash](Designing habits/Images/img_1.png)\n\nHello.\n";
    const out = markdownStandardImagesToHarvyFigures(md);
    expect(out).toContain("data-harvy-image");
    expect(out).toContain('src="Designing habits/Images/img_1.png"');
    expect(out).toContain('data-photographer-name="Luca Bravo"');
    expect(out).not.toContain("![Photo by");
  });

  it("converts escaped markdown image syntax from disk", () => {
    const md =
      "!\\[Photo by Luca Bravo on Unsplash\\](Designing habits/Images/img\\_1784422886509\\_1.png)\n\nHello.\n";
    const out = markdownStandardImagesToHarvyFigures(md);
    expect(out).toContain("data-harvy-image");
    expect(out).toContain('src="Designing habits/Images/img_1784422886509_1.png"');
    expect(out).toContain('data-photographer-name="Luca Bravo"');
    expect(out).not.toMatch(/!\\?\[/);
  });

  it("renders spaced-path markdown images into editor HTML figures", () => {
    const html = toEditorHtml(
      "![Photo by Luca Bravo on Unsplash](Designing habits/Images/img_1.png)\n\nBody.\n",
      { sourcePath: "/ws/Designing habits/Designing habits.md" },
    );
    expect(html).toContain("data-harvy-image");
    expect(html).toContain("Designing habits/Images/img_1.png");
    expect(html).toContain("Body");
    expect(html).not.toMatch(/!\[Photo by/);
  });

  it("renders escaped disk image syntax into figure HTML", () => {
    const html = toEditorHtml(
      "!\\[Photo by Luca Bravo on Unsplash\\](Designing habits/Images/img\\_1784422886509\\_1.png)\n\nBody.\n",
      { sourcePath: "/Users/alexlacy/Downloads/Essays/Designing habits/Designing habits.md" },
    );
    expect(html).toContain("data-harvy-image");
    expect(html).toContain("img_1784422886509_1.png");
    expect(html).not.toMatch(/!\\?\[/);
  });

  it("still converts images with simple destinations", () => {
    const html = markdownToEditorHtml("![alt text](Images/pic.png)\n");
    expect(html).toContain("data-harvy-image");
    expect(html).toContain('src="Images/pic.png"');
  });
});
