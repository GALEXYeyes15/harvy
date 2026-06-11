export type TweetStatus = "draft" | "edited" | "favorite" | "published";

export type TweetItem = {
  id: string;
  text: string;
  status: TweetStatus;
};

const PLACEHOLDER_TWEET_TEXTS = [
  "Most people think organization is about folders. It's really about the decisions you make before you create a single file.",
  "Your file structure isn't the problem. The problem is that you never decided what each folder is allowed to contain.",
  "Every system eventually reveals its assumptions. The question is whether you designed those assumptions on purpose.",
  "Good writing starts with a single clear claim. Everything else is evidence, contrast, or consequence.",
  "The best tools disappear. You stop thinking about the interface and start thinking about the idea.",
  "Constraints are not the enemy of creativity. They are how creativity becomes repeatable.",
  "A draft is not a failure of quality. It is proof that you started before you felt ready.",
  "Most essays fail in the first paragraph because the writer is still negotiating with themselves.",
  "Clarity is not the removal of complexity. It is the careful ordering of what matters.",
  "Your reader does not need more information. They need a reason to keep reading the next sentence.",
];

export function createPlaceholderTweets(count: number): TweetItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `tweet-${index + 1}`,
    text: PLACEHOLDER_TWEET_TEXTS[index % PLACEHOLDER_TWEET_TEXTS.length]!,
    status: "draft",
  }));
}

export function tweetStatusLabel(status: TweetStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "edited":
      return "Edited";
    case "favorite":
      return "Favorite";
    case "published":
      return "Published";
  }
}
