import { Copy, Pencil, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { tweetStatusLabel, type TweetItem, type TweetStatus } from "../features/format/tweetCollection";
import { TweetEditorModal } from "./TweetEditorModal";

const ACTION_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md text-muted/55 transition-colors hover:bg-white/[0.06] hover:text-ink dark:hover:text-white/90";

type TweetsCollectionTableProps = {
  tweets: TweetItem[];
  onTweetsChange: (tweets: TweetItem[]) => void;
};

export function TweetsCollectionTable({ tweets, onTweetsChange }: TweetsCollectionTableProps) {
  const [editingTweetId, setEditingTweetId] = useState<string | null>(null);

  const editingTweet = useMemo(
    () => tweets.find((tweet) => tweet.id === editingTweetId) ?? null,
    [tweets, editingTweetId],
  );

  const updateTweet = (tweetId: string, patch: Partial<TweetItem>) => {
    onTweetsChange(
      tweets.map((tweet) => (tweet.id === tweetId ? { ...tweet, ...patch } : tweet)),
    );
  };

  const removeTweet = (tweetId: string) => {
    onTweetsChange(tweets.filter((tweet) => tweet.id !== tweetId));
  };

  const copyTweet = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be unavailable outside secure context.
    }
  };

  const toggleFavorite = (tweet: TweetItem) => {
    const nextStatus: TweetStatus = tweet.status === "favorite" ? "draft" : "favorite";
    updateTweet(tweet.id, { status: nextStatus });
  };

  const saveTweet = (tweetId: string, text: string) => {
    updateTweet(tweetId, { text, status: "edited" });
  };

  return (
    <>
      <div className="harvy-tweets-collection-table flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-page">
              <tr className="border-b border-line/20 dark:border-white/[0.08]">
                <th className="pb-3 pr-4 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
                  Tweet
                </th>
                <th className="w-[6.5rem] pb-3 pr-4 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
                  Status
                </th>
                <th className="w-[8.5rem] pb-3 pt-1 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tweets.map((tweet) => (
                <tr
                  key={tweet.id}
                  className="group cursor-pointer border-b border-line/12 transition-colors last:border-b-0 hover:bg-ink/[0.03] dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                  onClick={() => setEditingTweetId(tweet.id)}
                >
                  <td className="py-3.5 pr-4 align-top">
                    <p className="line-clamp-2 text-[13px] leading-snug text-ink/92 dark:text-white/88">
                      {tweet.text}
                    </p>
                  </td>
                  <td className="py-3.5 pr-4 align-top">
                    <span className="text-[12px] text-muted/70 dark:text-white/50">
                      {tweetStatusLabel(tweet.status)}
                    </span>
                  </td>
                  <td className="py-3 align-top">
                    <div
                      className="flex items-center justify-end gap-0.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={ACTION_BUTTON}
                        aria-label="Copy tweet"
                        onClick={() => void copyTweet(tweet.text)}
                      >
                        <Copy size={14} strokeWidth={1.75} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={ACTION_BUTTON}
                        aria-label="Edit tweet"
                        onClick={() => setEditingTweetId(tweet.id)}
                      >
                        <Pencil size={14} strokeWidth={1.75} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={`${ACTION_BUTTON} ${
                          tweet.status === "favorite" ? "text-[#2fbf71]" : ""
                        }`}
                        aria-label="Favorite tweet"
                        onClick={() => toggleFavorite(tweet)}
                      >
                        <Star
                          size={14}
                          strokeWidth={1.75}
                          fill={tweet.status === "favorite" ? "currentColor" : "none"}
                          aria-hidden
                        />
                      </button>
                      <button
                        type="button"
                        className={`${ACTION_BUTTON} hover:text-[#e5484d]`}
                        aria-label="Delete tweet"
                        onClick={() => removeTweet(tweet.id)}
                      >
                        <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TweetEditorModal
        open={editingTweetId !== null}
        tweet={editingTweet}
        onClose={() => setEditingTweetId(null)}
        onSave={saveTweet}
      />
    </>
  );
}
