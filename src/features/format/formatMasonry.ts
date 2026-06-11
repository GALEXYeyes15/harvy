import { formatGalleryCardAspect, type FormatCardAspect, type FormatGalleryCard } from "./formatOutputs";

/** Relative block height for a unit column width (height ÷ width). */
export function formatCardHeightRatio(aspect: FormatCardAspect): number {
  switch (aspect) {
    case "16:9":
      return 9 / 16;
    case "3:4":
      return 4 / 3;
    case "9:16":
      return 16 / 9;
    case "8.5:11":
      return 11 / 8.5;
    case "1:1":
      return 1;
  }
}

/** Pack cards into the shortest column so mixed heights sit flush without row gaps. */
export function distributeFormatGalleryCards(
  cards: FormatGalleryCard[],
  columnCount: number,
): FormatGalleryCard[][] {
  const count = Math.max(1, columnCount);
  const columns = Array.from({ length: count }, () => [] as FormatGalleryCard[]);
  const columnHeights = new Array<number>(count).fill(0);

  for (const card of cards) {
    let targetColumn = 0;
    for (let i = 1; i < count; i += 1) {
      if (columnHeights[i]! < columnHeights[targetColumn]!) {
        targetColumn = i;
      }
    }

    columns[targetColumn]!.push(card);
    columnHeights[targetColumn]! += formatCardHeightRatio(formatGalleryCardAspect(card));
  }

  return columns;
}
