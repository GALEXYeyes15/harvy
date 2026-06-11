import { useEffect, useMemo, useState } from "react";
import type { FormatGalleryCard } from "../features/format/formatOutputs";
import { createPlaceholderTweets, type TweetItem } from "../features/format/tweetCollection";
import { TweetsCollectionTable } from "./TweetsCollectionTable";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type FormatOutputModalProps = {
  open: boolean;
  title: string;
  card: FormatGalleryCard | null;
  generatedTwitterTweets: TweetItem[] | null;
  onGeneratedTwitterTweetsChange: (tweets: TweetItem[]) => void;
  onTweetFavoritedForCollect?: (tweetText: string) => "added" | "duplicate";
  onClose: () => void;
};

function isTweetsCollection(card: FormatGalleryCard | null): card is Extract<
  FormatGalleryCard,
  { kind: "collection" }
> {
  return card?.kind === "collection" && card.platform === "x";
}

function TweetsCollectionModalBody({
  card,
  generatedTwitterTweets,
  onGeneratedTwitterTweetsChange,
  onTweetFavoritedForCollect,
}: {
  card: Extract<FormatGalleryCard, { kind: "collection" }>;
  generatedTwitterTweets: TweetItem[] | null;
  onGeneratedTwitterTweetsChange: (tweets: TweetItem[]) => void;
  onTweetFavoritedForCollect?: (tweetText: string) => "added" | "duplicate";
}) {
  const [placeholderTweets, setPlaceholderTweets] = useState<TweetItem[]>(() =>
    createPlaceholderTweets(card.count),
  );

  useEffect(() => {
    if (!generatedTwitterTweets) {
      setPlaceholderTweets(createPlaceholderTweets(card.count));
    }
  }, [card.count, generatedTwitterTweets]);

  const tweets = generatedTwitterTweets ?? placeholderTweets;
  const handleTweetsChange = (nextTweets: TweetItem[]) => {
    if (generatedTwitterTweets) {
      onGeneratedTwitterTweetsChange(nextTweets);
      return;
    }
    setPlaceholderTweets(nextTweets);
  };

  const subtitle = useMemo(() => `${tweets.length} tweets`, [tweets.length]);

  return (
    <>
      <p className="sr-only">{subtitle}</p>
      <TweetsCollectionTable
        tweets={tweets}
        onTweetsChange={handleTweetsChange}
        onTweetFavorited={onTweetFavoritedForCollect}
      />
    </>
  );
}

export function FormatOutputModal({
  open,
  title,
  card,
  generatedTwitterTweets,
  onGeneratedTwitterTweetsChange,
  onTweetFavoritedForCollect,
  onClose,
}: FormatOutputModalProps) {
  const tweetsCollection = isTweetsCollection(card);
  const tweetCount = tweetsCollection
    ? (generatedTwitterTweets?.length ?? card.count)
    : 0;

  if (tweetsCollection) {
    return (
      <CenteredOverlayModal
        open={open}
        onClose={onClose}
        title={title}
        subtitle={`${tweetCount} tweets`}
        titleId="harvy-format-output-modal-title"
        backdropLabel="Close tweets collection"
        closeLabel="Close tweets collection"
        maxWidthClass="max-w-[min(920px,calc(100vw-3rem))]"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-2"
      >
        <TweetsCollectionModalBody
          card={card}
          generatedTwitterTweets={generatedTwitterTweets}
          onGeneratedTwitterTweetsChange={onGeneratedTwitterTweetsChange}
          onTweetFavoritedForCollect={onTweetFavoritedForCollect}
        />
      </CenteredOverlayModal>
    );
  }

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title={title}
      titleId="harvy-format-output-modal-title"
      backdropLabel="Close format editor"
      closeLabel="Close format editor"
      maxWidthClass="max-w-[min(720px,calc(100vw-3rem))]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-6 py-6"
    >
      <p className="text-[14px] leading-relaxed text-muted/80">
        Format editor placeholder — generation and editing will live here.
      </p>
      <div className="mt-5 min-h-[220px] rounded-xl border border-line/25 bg-canvas/40 px-4 py-4 dark:bg-canvas/25">
        <p className="text-[13px] text-muted/55">Content preview area</p>
      </div>
    </CenteredOverlayModal>
  );
}
