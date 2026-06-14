import type { MockOutlierPost } from "./mockOutlierPosts";

function estimateCardHeight(post: MockOutlierPost): number {
  let height = post.preview.length > 120 ? 1.35 : 1;
  if (post.hasThumbnail) {
    height += post.thumbnailHeight === "tall" ? 1.65 : 1.05;
  }
  if (post.captionBelowThumbnail) {
    height += 0.25;
  }
  return height;
}

/** Pack outlier cards into the shortest column for a masonry layout. */
export function distributeOutlierPosts(
  posts: MockOutlierPost[],
  columnCount: number,
): MockOutlierPost[][] {
  const count = Math.max(1, columnCount);
  const columns = Array.from({ length: count }, () => [] as MockOutlierPost[]);
  const columnHeights = new Array<number>(count).fill(0);

  for (const post of posts) {
    let targetColumn = 0;
    for (let i = 1; i < count; i += 1) {
      if (columnHeights[i]! < columnHeights[targetColumn]!) {
        targetColumn = i;
      }
    }

    columns[targetColumn]!.push(post);
    columnHeights[targetColumn]! += estimateCardHeight(post);
  }

  return columns;
}
