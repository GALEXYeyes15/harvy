import type { CollectItem } from "./collectItems";
import { createCollectItem, todayCollectDateCreated } from "./collectItems";

export type AddTweetToCollectResult = "added" | "duplicate";

function normalizeTweetText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function isTweetCraftInCollect(items: CollectItem[], tweetText: string): boolean {
  const normalized = normalizeTweetText(tweetText);
  if (!normalized) return false;

  return items.some(
    (item) =>
      item.format.trim().toLowerCase() === "tweet" &&
      item.type === "Craft" &&
      normalizeTweetText(item.preview) === normalized,
  );
}

/** Add a favorited tweet to Collect as Craft inspiration. Skips duplicates. */
export function addTweetToCollectAsCraft(
  items: CollectItem[],
  tweetText: string,
): { items: CollectItem[]; result: AddTweetToCollectResult } {
  const trimmed = tweetText.trim();
  if (!trimmed) {
    return { items, result: "duplicate" };
  }

  if (isTweetCraftInCollect(items, trimmed)) {
    return { items, result: "duplicate" };
  }

  const base = createCollectItem();
  const newItem: CollectItem = {
    ...base,
    preview: trimmed,
    format: "Tweet",
    type: "Craft",
    dateCreated: todayCollectDateCreated(),
  };

  return { items: [...items, newItem], result: "added" };
}
