import type { FormatCollectionResult } from "./formatOutputTypes";
import type { TweetItem } from "./tweetCollection";

export type GeneratedTwitterCollection = {
  title: string;
  tweets: TweetItem[];
};

export function tweetItemsFromCollection(collection: FormatCollectionResult): GeneratedTwitterCollection {
  return {
    title: collection.title,
    tweets: collection.items.map((item) => ({
      id: item.id,
      text: item.content,
      status:
        item.favorite || item.status === "favorite"
          ? "favorite"
          : item.status === "edited" || item.status === "published"
            ? item.status
            : "draft",
    })),
  };
}

/** @deprecated Use tweetItemsFromCollection */
export function tweetItemsFromGeneration(result: {
  title: string;
  items: Array<{ id: string; text: string; status?: string; favorite?: boolean }>;
}): GeneratedTwitterCollection {
  return tweetItemsFromCollection({
    category: "tweets_notes",
    type: "collection",
    title: result.title,
    items: result.items.map((item) => ({
      id: item.id,
      title: null,
      content: item.text,
      status:
        item.favorite || item.status === "favorite"
          ? "favorite"
          : item.status === "edited" || item.status === "published"
            ? item.status
            : "draft",
      favorite: Boolean(item.favorite || item.status === "favorite"),
    })),
  });
}
