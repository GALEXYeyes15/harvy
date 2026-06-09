import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import { documentTextForStats } from "../features/editor/documentMarkdown";

type FormatPreviewProps = {
  editor: Editor | null;
  /** Stored markdown when the TipTap instance is unavailable. */
  fallbackText: string;
};

function readPreviewText(editor: Editor | null, fallback: string): string {
  if (editor && !editor.isDestroyed) {
    return editor.getText({ blockSeparator: "\n\n" });
  }
  return documentTextForStats(fallback);
}

export function FormatPreview({ editor, fallbackText }: FormatPreviewProps) {
  const [previewText, setPreviewText] = useState(() => readPreviewText(editor, fallbackText));

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      setPreviewText(documentTextForStats(fallbackText));
      return;
    }

    const sync = () => setPreviewText(editor.getText({ blockSeparator: "\n\n" }));
    sync();
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor, fallbackText]);

  return (
    <div className="harvy-format-workspace" aria-label="Format preview">
      <div className="harvy-format-preview-card">
        <div className="harvy-format-preview-content whitespace-pre-wrap">{previewText || "\u00a0"}</div>
      </div>
    </div>
  );
}
