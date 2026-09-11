import { useMemo } from "react";
import {
  buildSaveAsFolderPreviewRoot,
  renderSaveAsFolderPreviewLines,
  type SaveAsFolderPreviewContext,
} from "../features/save/saveAsFolderPreview";

type SaveAsFolderPreviewProps = {
  folderBase: string;
  leafFileName: string;
  context: SaveAsFolderPreviewContext;
  /** When true, render tree only (no bordered panel) for use inside the Folder card. */
  inline?: boolean;
};

export function SaveAsFolderPreview({
  folderBase,
  leafFileName,
  context,
  inline = false,
}: SaveAsFolderPreviewProps) {
  const previewText = useMemo(() => {
    const root = buildSaveAsFolderPreviewRoot(folderBase, leafFileName, context);
    return renderSaveAsFolderPreviewLines(root).join("\n");
  }, [folderBase, leafFileName, context]);

  const tree = (
    <pre className="overflow-x-auto whitespace-pre font-mono text-[12px] leading-[1.4] text-muted/68">
      {previewText}
    </pre>
  );

  if (inline) {
    return (
      <div aria-label="Project folder structure preview" className="min-w-0">
        {tree}
      </div>
    );
  }

  return (
    <div
      className="rounded-[10px] border border-[#6f6f6f]/55 bg-ink/[0.03] px-3 py-2 dark:bg-ink/[0.05]"
      aria-label="Project folder structure preview"
    >
      {tree}
    </div>
  );
}
