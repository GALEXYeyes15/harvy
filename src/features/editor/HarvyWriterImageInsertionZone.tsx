export type HarvyWriterImageInsertionZonePosition = "before-image" | "after-image";

const INSERTION_ZONE_LABELS: Record<HarvyWriterImageInsertionZonePosition, string> = {
  "before-image": "Insert Text Above",
  "after-image": "Insert Text Below",
};

type HarvyWriterImageInsertionZoneProps = {
  position: HarvyWriterImageInsertionZonePosition;
};

/** Click target with hover label — activation is handled in the harvyWriterImage ProseMirror plugin. */
export function HarvyWriterImageInsertionZone({ position }: HarvyWriterImageInsertionZoneProps) {
  const isBefore = position === "before-image";
  const label = INSERTION_ZONE_LABELS[position];

  return (
    <div
      className={`harvy-image-node__insertion-zone ${
        isBefore ? "harvy-image-node__insertion-zone--before" : "harvy-image-node__insertion-zone--after"
      }`}
      data-insertion-zone={position}
      contentEditable={false}
      suppressContentEditableWarning
      aria-label={label}
      role="group"
    >
      <span className="harvy-image-node__insertion-zone-label" aria-hidden>
        {label}
      </span>
    </div>
  );
}
