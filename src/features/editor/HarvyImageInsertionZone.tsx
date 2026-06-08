export type HarvyImageInsertionZonePosition = "before-image" | "after-image";

const INSERTION_ZONE_LABELS: Record<HarvyImageInsertionZonePosition, string> = {
  "before-image": "Insert Text Above",
  "after-image": "Insert Text Below",
};

type HarvyImageInsertionZoneProps = {
  position: HarvyImageInsertionZonePosition;
};

/** Click target with hover label — activation is handled in the harvyImage ProseMirror plugin. */
export function HarvyImageInsertionZone({ position }: HarvyImageInsertionZoneProps) {
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
