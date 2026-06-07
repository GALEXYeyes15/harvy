import type { MouseEvent } from "react";

export type HarvyImageInsertionZonePosition = "before-image" | "after-image";

type HarvyImageInsertionZoneProps = {
  position: HarvyImageInsertionZonePosition;
  onActivate: () => void;
};

export function HarvyImageInsertionZone({ position, onActivate }: HarvyImageInsertionZoneProps) {
  const isBefore = position === "before-image";

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  };

  return (
    <div
      className={`harvy-image-node__insertion-zone ${
        isBefore ? "harvy-image-node__insertion-zone--before" : "harvy-image-node__insertion-zone--after"
      }`}
      data-insertion-zone={position}
      role="presentation"
      aria-hidden
      onMouseDown={handleMouseDown}
    />
  );
}
