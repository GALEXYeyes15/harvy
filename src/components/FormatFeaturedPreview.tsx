import type {
  DocumentPreviewBlock,
  DocumentPreviewHeading,
} from "../features/format/documentPreviewBlocks";

const PREVIEW_TEXT = "text-[10px] leading-[1.55] text-muted/80";

function headingClass(level: DocumentPreviewHeading["level"]): string {
  switch (level) {
    case 1:
      return "mt-2 font-semibold first:mt-0";
    case 2:
      return "mt-1.5 font-semibold first:mt-0";
    case 3:
      return "mt-1 font-medium first:mt-0";
    default:
      return "mt-0.5 font-medium first:mt-0";
  }
}

function PreviewBlock({ block, index }: { block: DocumentPreviewBlock; index: number }) {
  switch (block.kind) {
    case "heading":
      return (
        <p key={index} className={`${PREVIEW_TEXT} ${headingClass(block.level)}`}>
          {block.text}
        </p>
      );
    case "paragraph":
      return (
        <p
          key={index}
          className={PREVIEW_TEXT}
          style={block.indent ? { paddingLeft: block.indent * 10 } : undefined}
        >
          {block.lines.map((line, lineIndex) => (
            <span key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {line}
            </span>
          ))}
        </p>
      );
    case "list-item":
      return (
        <p
          key={index}
          className={`${PREVIEW_TEXT} flex gap-1`}
          style={{ paddingLeft: 4 + block.depth * 10 }}
        >
          <span className="w-[1.1em] shrink-0 tabular-nums">{block.marker}</span>
          <span className="min-w-0 flex-1">{block.text}</span>
        </p>
      );
    default:
      return null;
  }
}

export function FormatFeaturedPreview({ blocks }: { blocks: DocumentPreviewBlock[] }) {
  if (blocks.length === 0) {
    return (
      <p className={PREVIEW_TEXT}>Start writing to see a preview of your essay here.</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {blocks.map((block, index) => (
        <PreviewBlock key={index} block={block} index={index} />
      ))}
    </div>
  );
}
