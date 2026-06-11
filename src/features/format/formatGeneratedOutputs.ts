import type { TwitterFormatGenerationResult } from "./formatGenerationTypes";
import type { TweetItem } from "./tweetCollection";

export type GeneratedTwitterCollection = {
  title: string;
  tweets: TweetItem[];
};

export function tweetItemsFromGeneration(result: TwitterFormatGenerationResult): GeneratedTwitterCollection {
  return {
    title: result.title,
    tweets: result.items.map((item) => ({
      id: item.id,
      text: item.text,
      status:
        item.favorite || item.status === "favorite"
          ? "favorite"
          : item.status === "edited" || item.status === "published"
            ? item.status
            : "draft",
    })),
  };
}
