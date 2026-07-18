import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, it } from "vitest";
import { editorHtmlToMarkdown, toEditorHtml } from "./documentMarkdown";
import { HarvyParagraph } from "./harvyParagraph";

describe("blockquote", () => {
  it("round trips", () => {
    const ed = new Editor({
      extensions: [
        StarterKit.configure({ paragraph: false }),
        HarvyParagraph,
      ],
      content: "<blockquote><p>Quoted</p></blockquote>",
    });
    const html = ed.getHTML();
    const md = editorHtmlToMarkdown(html);
    console.log("BQ HTML", html);
    console.log("BQ MD", JSON.stringify(md));
    console.log("BQ RELOAD", toEditorHtml(md, { sourcePath: "n.md" }));
    ed.commands.setContent(toEditorHtml(md, { sourcePath: "n.md" }));
    console.log("BQ AFTER", ed.getHTML());
    ed.destroy();
  });
});
