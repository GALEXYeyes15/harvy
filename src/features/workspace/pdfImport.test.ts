import { describe, expect, it } from "vitest";
import { ingestTextFileContent } from "../editor/documentMarkdown";
import {
  pdfExtractedRunsToMarkdown,
  pdfExtractedTextToMarkdown,
  siblingMarkdownPathForImport,
  type PdfTextRun,
} from "./pdfImport";

describe("siblingMarkdownPathForImport", () => {
  it("keeps the basename and swaps the extension", () => {
    expect(siblingMarkdownPathForImport("/workspace/Drafts/Q3 Report.pdf")).toBe(
      "/workspace/Drafts/Q3 Report.md",
    );
    expect(siblingMarkdownPathForImport("C:\\Notes\\Brief.PDF")).toBe("C:\\Notes\\Brief.md");
  });
});

describe("pdfExtractedTextToMarkdown", () => {
  it("matches .txt ingest so line breaks and paragraphs stay intact", () => {
    const source = "Hello\nworld.\n\nNext\nparagraph.";
    expect(pdfExtractedTextToMarkdown(source)).toBe(ingestTextFileContent(source, "document.txt"));
    expect(pdfExtractedTextToMarkdown(source)).toBe("Hello  \nworld.\n\nNext  \nparagraph.\n");
  });

  it("preserves extra blank lines as empty paragraphs", () => {
    expect(pdfExtractedTextToMarkdown("Hello\n\n\nWorld")).toBe("Hello\n\n<p></p>\n\nWorld\n");
  });

  it("returns an empty string when there is no text", () => {
    expect(pdfExtractedTextToMarkdown("")).toBe("");
  });
});

function run(partial: Partial<PdfTextRun> & { text: string }): PdfTextRun {
  return {
    fontSize: 12,
    bold: false,
    italic: false,
    underline: false,
    ...partial,
  };
}

describe("pdfExtractedRunsToMarkdown", () => {
  it("turns larger title and section type into h1 and h2", () => {
    const markdown = pdfExtractedRunsToMarkdown([
      run({
        text: "From Victim to Villain: How Negativity\nNearly Cost Me Everything\n",
        fontSize: 22,
        bold: true,
      }),
      run({ text: "The Wake-Up Call\n", fontSize: 16, bold: true }),
      run({
        text: "I used to think I was just being realistic.\nThen a close friend sat me down.",
        fontSize: 12,
      }),
    ]);

    expect(markdown).toBe(
      [
        "# From Victim to Villain: How Negativity Nearly Cost Me Everything",
        "",
        "## The Wake-Up Call",
        "",
        "I used to think I was just being realistic.  ",
        "Then a close friend sat me down.",
        "",
      ].join("\n"),
    );
  });

  it("keeps bold, italic, underline, and links", () => {
    expect(
      pdfExtractedRunsToMarkdown([
        run({ text: "plain " }),
        run({ text: "bold", bold: true }),
        run({ text: " " }),
        run({ text: "italic", italic: true }),
        run({ text: " " }),
        run({ text: "both", bold: true, italic: true }),
        run({ text: " " }),
        run({ text: "under", underline: true }),
        run({ text: " " }),
        run({ text: "site", href: "https://example.com" }),
      ]),
    ).toBe("plain **bold** *italic* ***both*** <u>under</u> [site](https://example.com)\n");
  });

  it("maps a third larger size to h3", () => {
    expect(
      pdfExtractedRunsToMarkdown([
        run({ text: "Title\n", fontSize: 24, bold: true }),
        run({ text: "Section\n", fontSize: 18, bold: true }),
        run({ text: "Aside\n", fontSize: 14.5, bold: true }),
        run({ text: "Body copy that is long enough to be the document’s main size.", fontSize: 11 }),
      ]),
    ).toBe(
      "# Title\n\n## Section\n\n### Aside\n\nBody copy that is long enough to be the document’s main size.\n",
    );
  });

  it("converts bullet glyphs to lists", () => {
    expect(
      pdfExtractedRunsToMarkdown([
        run({ text: "• First\n" }),
        run({ text: "• Second" }),
      ]),
    ).toBe("- First\n- Second\n");
  });

  it("falls back to plain text ingest when there is no formatting", () => {
    expect(
      pdfExtractedRunsToMarkdown([run({ text: "Hello\nworld.", fontSize: 0 })]),
    ).toBe(pdfExtractedTextToMarkdown("Hello\nworld."));
  });

  it("returns an empty string when there are no runs", () => {
    expect(pdfExtractedRunsToMarkdown([])).toBe("");
  });
});
