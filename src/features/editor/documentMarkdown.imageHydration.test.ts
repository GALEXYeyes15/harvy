import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { toEditorHtml } from "./documentMarkdown";
import { HarvyImage } from "./harvyImage";
import { HarvyParagraph } from "./harvyParagraph";

function createEditor(html: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ paragraph: false, heading: { levels: [1, 2, 3] } }),
      HarvyParagraph,
      HarvyImage,
    ],
    content: html,
  });
}

describe("markdown image open → harvyImage node", () => {
  it("hydrates escaped spaced-path Unsplash markdown into a harvyImage node", () => {
    const md =
      "!\\[Photo by Luca Bravo on Unsplash\\](Designing habits/Images/img\\_1784422886509\\_1.png)\n\nHello world.\n";
    const html = toEditorHtml(md, {
      sourcePath: "/Essays/Designing habits/Designing habits.md",
    });
    expect(html).toContain("data-harvy-image");

    const editor = createEditor(html);
    let imageCount = 0;
    let src = "";
    editor.state.doc.descendants((node) => {
      if (node.type.name !== "harvyImage") return;
      imageCount += 1;
      src = String(node.attrs.src ?? "");
    });
    editor.destroy();

    expect(imageCount).toBe(1);
    expect(src).toBe("Designing habits/Images/img_1784422886509_1.png");
  });

  it("hydrates spaced-path Unsplash markdown into a harvyImage node", () => {
    const md =
      "![Photo by Luca Bravo on Unsplash](Designing habits/Images/img_1784422886509_1.png)\n\nHello world.\n";
    const html = toEditorHtml(md, {
      sourcePath: "/Essays/Designing habits/Designing habits.md",
    });
    expect(html).toContain("data-harvy-image");

    const editor = createEditor(html);
    let imageCount = 0;
    let src = "";
    editor.state.doc.descendants((node) => {
      if (node.type.name !== "harvyImage") return;
      imageCount += 1;
      src = String(node.attrs.src ?? "");
    });
    editor.destroy();

    expect(imageCount).toBe(1);
    expect(src).toBe("Designing habits/Images/img_1784422886509_1.png");
    expect(editorHtmlHasRawMarkdownImage(html)).toBe(false);
  });
});

function editorHtmlHasRawMarkdownImage(html: string): boolean {
  return /!\[/.test(html);
}
