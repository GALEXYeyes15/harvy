import { ingestTextFileContent } from "../editor/documentMarkdown";
import { fileNameFromPath } from "../save/saveRuntime";
import { joinPath, parentDirectory, splitFileBaseAndExtension } from "./folderNaming";

/** Sibling Markdown path with the same basename, e.g. `Notes.pdf` → `Notes.md`. */
export function siblingMarkdownPathForImport(sourcePath: string): string {
  const leaf = fileNameFromPath(sourcePath);
  const { base } = splitFileBaseAndExtension(leaf);
  return joinPath(parentDirectory(sourcePath), `${base || "Untitled"}.md`);
}

export type PdfTextRun = {
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  href?: string | null;
};

type LineRun = {
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  href?: string | null;
};

/**
 * Convert extracted PDF text the same way Harvy ingests a `.txt` file:
 * single newlines stay line breaks, blank lines stay empty paragraphs.
 */
export function pdfExtractedTextToMarkdown(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return "";
  return ingestTextFileContent(normalized, "document.txt");
}

/** Convert attributed PDF runs into Harvy Markdown (headings, bold, italic, underline, links). */
export function pdfExtractedRunsToMarkdown(runs: PdfTextRun[]): string {
  if (!Array.isArray(runs) || runs.length === 0) return "";

  const hasMarks = runs.some(
    (run) => run.bold || run.italic || run.underline || Boolean(run.href) || run.fontSize > 0,
  );
  if (!hasMarks) {
    return pdfExtractedTextToMarkdown(runs.map((run) => run.text).join(""));
  }

  const lines = splitRunsIntoLines(runs);
  const bodySize = bodyFontSize(runs);
  const headingSizes = headingSizeRanks(runs, bodySize);

  const blocks: string[] = [];
  let headingBuffer: { level: 1 | 2 | 3; text: string } | null = null;
  let bodyBuffer: string[] = [];
  let listBuffer: string[] = [];
  let blankRun = 0;

  const flushHeading = () => {
    if (!headingBuffer) return;
    blocks.push(`${"#".repeat(headingBuffer.level)} ${headingBuffer.text}`);
    headingBuffer = null;
  };
  const flushBody = () => {
    if (bodyBuffer.length === 0) return;
    blocks.push(bodyBuffer.join("  \n"));
    bodyBuffer = [];
  };
  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(listBuffer.join("\n"));
    listBuffer = [];
  };
  const flushText = () => {
    flushHeading();
    flushBody();
    flushList();
  };

  for (const line of lines) {
    if (lineIsBlank(line)) {
      blankRun += 1;
      flushText();
      if (blankRun >= 2) blocks.push("<p></p>");
      continue;
    }
    blankRun = 0;

    const level = lineHeadingLevel(line, bodySize, headingSizes);
    if (level) {
      flushBody();
      flushList();
      const text = formatRuns(line, { skipBold: true }).trim();
      if (!text) continue;
      const endsSentence = /[.!?]"?$/.test(headingBuffer?.text ?? "");
      if (headingBuffer && headingBuffer.level === level && !endsSentence) {
        headingBuffer.text = `${headingBuffer.text} ${text}`;
      } else {
        flushHeading();
        headingBuffer = { level, text };
      }
      continue;
    }

    flushHeading();
    const list = lineListKind(line);
    if (list) {
      flushBody();
      const content = formatRuns(list.runs, { skipBold: false }).trim();
      if (!content) continue;
      listBuffer.push(list.kind === "ol" ? `1. ${content}` : `- ${content}`);
      continue;
    }

    flushList();
    const formatted = formatRuns(line, { skipBold: false });
    if (formatted) bodyBuffer.push(formatted);
  }

  flushText();
  while (blocks.length > 0 && blocks[blocks.length - 1] === "<p></p>") blocks.pop();
  while (blocks.length > 0 && blocks[0] === "<p></p>") blocks.shift();

  const markdown = blocks.join("\n\n");
  return markdown ? `${markdown}\n` : "";
}

function splitRunsIntoLines(runs: PdfTextRun[]): LineRun[][] {
  const lines: LineRun[][] = [[]];
  for (const run of runs) {
    const parts = run.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    parts.forEach((part, index) => {
      if (part) {
        lines[lines.length - 1]!.push({
          text: part,
          fontSize: run.fontSize,
          bold: run.bold,
          italic: run.italic,
          underline: run.underline,
          href: run.href,
        });
      }
      if (index < parts.length - 1) lines.push([]);
    });
  }
  return lines;
}

function lineIsBlank(line: LineRun[]): boolean {
  return line.every((run) => !run.text.trim());
}

function roundSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.round(size * 2) / 2;
}

function bodyFontSize(runs: PdfTextRun[]): number {
  const counts = new Map<number, number>();
  for (const run of runs) {
    const chars = run.text.replace(/\s/g, "").length;
    if (!chars) continue;
    const size = roundSize(run.fontSize);
    if (size <= 0) continue;
    counts.set(size, (counts.get(size) ?? 0) + chars);
  }
  let best = 12;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount || (count === bestCount && size < best)) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

function headingSizeRanks(runs: PdfTextRun[], bodySize: number): number[] {
  const threshold = Math.max(bodySize + 1.5, bodySize * 1.18);
  const sizes = new Set<number>();
  for (const run of runs) {
    const size = roundSize(run.fontSize);
    if (size >= threshold) sizes.add(size);
  }
  return [...sizes].sort((a, b) => b - a).slice(0, 3);
}

function lineHeadingLevel(
  line: LineRun[],
  bodySize: number,
  headingSizes: number[],
): 1 | 2 | 3 | null {
  if (headingSizes.length === 0) return null;
  const plain = line.map((run) => run.text).join("");
  if (plain.replace(/\s/g, "").length > 140) return null;

  let weighted = 0;
  let chars = 0;
  for (const run of line) {
    const n = run.text.replace(/\s/g, "").length;
    if (!n) continue;
    weighted += roundSize(run.fontSize) * n;
    chars += n;
  }
  if (chars === 0) return null;
  const size = weighted / chars;
  const threshold = Math.max(bodySize + 1.5, bodySize * 1.18);
  if (size < threshold) return null;

  let rank = headingSizes.findIndex((candidate) => size >= candidate - 0.25);
  if (rank < 0) rank = headingSizes.length - 1;
  return Math.min(rank + 1, 3) as 1 | 2 | 3;
}

function lineListKind(line: LineRun[]): { kind: "ul" | "ol"; runs: LineRun[] } | null {
  const plain = line.map((run) => run.text).join("");
  const bullet = plain.match(/^(\s*)([•●▪◦‣·]|[-–—*])\s+/);
  if (bullet) {
    return { kind: "ul", runs: consumePrefix(line, bullet[0].length) };
  }
  const numbered = plain.match(/^(\s*)(\d{1,2})[.)]\s+/);
  if (numbered) {
    return { kind: "ol", runs: consumePrefix(line, numbered[0].length) };
  }
  return null;
}

function consumePrefix(runs: LineRun[], prefixLen: number): LineRun[] {
  let left = prefixLen;
  const out: LineRun[] = [];
  for (const run of runs) {
    if (left >= run.text.length) {
      left -= run.text.length;
      continue;
    }
    if (left > 0) {
      out.push({ ...run, text: run.text.slice(left) });
      left = 0;
    } else {
      out.push(run);
    }
  }
  return out;
}

function formatRuns(runs: LineRun[], opts: { skipBold: boolean }): string {
  return runs.map((run) => formatRun(run, opts.skipBold)).join("");
}

function formatRun(run: LineRun, skipBold: boolean): string {
  if (!run.text) return "";
  if (!run.text.trim()) return run.text;

  let inner = escapeInlineMarkdown(run.text);
  const bold = run.bold && !skipBold;
  if (bold && run.italic) inner = `***${inner}***`;
  else if (run.italic) inner = `*${inner}*`;
  else if (bold) inner = `**${inner}**`;
  if (run.underline) inner = `<u>${inner}</u>`;
  const href = run.href?.trim();
  if (href) inner = `[${inner}](${href})`;
  return inner;
}

function escapeInlineMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>])/g, "\\$1");
}
