import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import {
  editorHtmlToMarkdown,
  ingestTextFileContent,
  markdownToEditorHtml,
  toEditorHtml,
} from "./documentMarkdown";
import { plainTextToHtml } from "./documentHtml";
import { HarvyParagraph } from "./harvyParagraph";

function createEditor(content: string): Editor {
  return new Editor({
    extensions: [StarterKit.configure({ paragraph: false }), HarvyParagraph],
    content,
  });
}

function countEmptyParagraphsInHtml(html: string): number {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  let count = 0;
  doc.querySelectorAll("p").forEach((p) => {
    const text = (p.textContent || "").replace(/\u00a0/g, " ").trim();
    if (!text && !p.querySelector("img, figure, video, iframe, object, embed, table")) {
      count += 1;
    }
  });
  return count;
}

function roundTripMarkdown(markdown: string): string {
  const html = toEditorHtml(markdown, { sourcePath: "doc.md" });
  return editorHtmlToMarkdown(html);
}

describe("document blank-line persistence", () => {
  it("preserves a single newline paragraph break (no empty middle paragraph)", () => {
    const html = "<p>a</p><p>b</p>";
    const md = editorHtmlToMarkdown(html);
    expect(md).toBe("a\n\nb\n");
    expect(countEmptyParagraphsInHtml(toEditorHtml(md, { sourcePath: "doc.md" }))).toBe(0);
  });

  it("preserves two consecutive newlines as one empty paragraph", () => {
    const html = "<p>a</p><p></p><p>b</p>";
    const before = editorHtmlToMarkdown(html);
    expect(before).toContain("<p></p>");
    const after = roundTripMarkdown(before);
    expect(after).toBe(before);
    expect(countEmptyParagraphsInHtml(toEditorHtml(before, { sourcePath: "doc.md" }))).toBe(1);
  });

  it("preserves three or more consecutive empty paragraphs", () => {
    const html = "<p>a</p><p></p><p></p><p></p><p>b</p>";
    const before = editorHtmlToMarkdown(html);
    const after = roundTripMarkdown(before);
    expect(after).toBe(before);
    expect(countEmptyParagraphsInHtml(toEditorHtml(before, { sourcePath: "doc.md" }))).toBe(3);
  });

  it("preserves a blank line in the middle of the document", () => {
    const html =
      "<p>It’s ingrained into my lifestyle</p><p></p><p>When I started the gym routine…</p>";
    const before = editorHtmlToMarkdown(html);
    expect(before).toBe(
      "It’s ingrained into my lifestyle\n\n<p></p>\n\nWhen I started the gym routine…\n",
    );
    expect(roundTripMarkdown(before)).toBe(before);
  });

  it("preserves blank lines near the beginning and end", () => {
    const html = "<p></p><p>start</p><p>end</p><p></p>";
    const before = editorHtmlToMarkdown(html);
    expect(before.startsWith("<p></p>")).toBe(true);
    expect(before.trimEnd().endsWith("<p></p>")).toBe(true);
    expect(roundTripMarkdown(before)).toBe(before);
    expect(countEmptyParagraphsInHtml(toEditorHtml(before, { sourcePath: "doc.md" }))).toBe(2);
  });

  it("preserves multiple empty paragraph nodes from editor HTML including br-only empties", () => {
    const html = "<p>a</p><p><br></p><p></p><p>b</p>";
    const before = editorHtmlToMarkdown(html);
    expect(before).toBe("a\n\n<p></p>\n\n<p></p>\n\nb\n");
    expect(roundTripMarkdown(before)).toBe(before);
  });

  it("save → reopen: serializedAfterReload === serializedBeforeSave", () => {
    const html =
      "<p>First</p><p></p><p>Second</p><p></p><p></p><p>Third</p>";
    const serializedBeforeSave = editorHtmlToMarkdown(html);
    const reopenedHtml = toEditorHtml(serializedBeforeSave, { sourcePath: "notes.md" });
    const serializedAfterReload = editorHtmlToMarkdown(reopenedHtml);
    expect(serializedAfterReload).toBe(serializedBeforeSave);
  });

  it("autosave buffer → ingest → reopen does not strip blank lines", () => {
    const liveMarkdown = editorHtmlToMarkdown(
      "<p>It’s ingrained into my lifestyle</p><p></p><p>When I started the gym routine…</p>",
    );
    // Simulate write_text_file / read_workspace_text_file (bytes unchanged) then ingest.
    const ingested = ingestTextFileContent(liveMarkdown, "/workspace/doc.md");
    expect(ingested).toBe(liveMarkdown);
    expect(roundTripMarkdown(ingested)).toBe(liveMarkdown);
  });

  it("preserves blank lines from pasted plain text", () => {
    const pasted = "alpha\n\n\nbeta\n\ngamma";
    const html = plainTextToHtml(pasted);
    expect(html).toContain("<p></p>");
    expect(countEmptyParagraphsInHtml(html)).toBeGreaterThanOrEqual(1);
    const md = editorHtmlToMarkdown(html);
    expect(roundTripMarkdown(md)).toBe(md);
  });

  it("repeated save/reopen cycles do not drift whitespace", () => {
    let md = editorHtmlToMarkdown(
      "<p>One</p><p></p><p>Two</p><p></p><p></p><p>Three</p><p></p>",
    );
    for (let i = 0; i < 5; i++) {
      const next = roundTripMarkdown(md);
      expect(next).toBe(md);
      md = next;
    }
  });

  it("does not invent extra blank lines for existing documents without empty islands", () => {
    const legacy = "Hello\n\nWorld\n";
    const html = markdownToEditorHtml(legacy);
    expect(countEmptyParagraphsInHtml(html)).toBe(0);
    expect(editorHtmlToMarkdown(html)).toBe(legacy);
  });

  it("hydrates in-memory markdown (no source path) that starts with an empty island", () => {
    const md = "<p></p>\n\nHello\n\nWorld\n";
    const html = toEditorHtml(md);
    expect(countEmptyParagraphsInHtml(html)).toBe(1);
    expect(editorHtmlToMarkdown(html)).toBe(md);
  });
});

describe("editor hydration keeps visible empty paragraphs", () => {
  it("keeps an empty paragraph node after markdown round-trip hydration", () => {
    const ed = createEditor(
      "<p>It’s ingrained into my lifestyle</p><p></p><p>When I started the gym routine…</p>",
    );
    try {
      const beforeSave = editorHtmlToMarkdown(ed.getHTML());
      const hydrated = toEditorHtml(beforeSave, { sourcePath: "doc.md" });
      ed.commands.setContent(hydrated);

      let emptyCount = 0;
      ed.state.doc.forEach((node) => {
        if (node.type.name === "paragraph" && node.content.size === 0) emptyCount += 1;
      });
      expect(emptyCount).toBe(1);
      expect(editorHtmlToMarkdown(ed.getHTML())).toBe(beforeSave);
    } finally {
      ed.destroy();
    }
  });
});
