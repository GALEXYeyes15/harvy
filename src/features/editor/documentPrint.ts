import type { Editor } from "@tiptap/core";
import { markdownToEditorHtml } from "./documentMarkdown";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Open the native print dialog for the current document. */
export function printDocumentFromEditor(
  editor: Editor | null,
  fallbackMarkdown: string,
  title: string,
): void {
  const bodyHtml = editor?.getHTML()?.trim()
    ? editor.getHTML()
    : markdownToEditorHtml(fallbackMarkdown);

  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    window.alert("Could not open the print dialog. Allow pop-ups and try again.");
    return;
  }

  const safeTitle = escapeHtml(title.trim() || "Document");
  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    body {
      margin: 1.25in;
      font-family: "Libre Baskerville", "Baskerville", Georgia, serif;
      font-size: 12pt;
      line-height: 1.55;
      color: #111;
    }
    img { max-width: 100%; height: auto; }
    a { color: inherit; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`);
  printWindow.document.close();

  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
