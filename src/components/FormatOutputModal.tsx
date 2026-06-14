import { useMemo } from "react";
import type { FormatGalleryCard } from "../features/format/formatOutputs";
import type { TweetItem } from "../features/format/tweetCollection";
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
  return card?.kind === "collection" && card.categoryId === "tweets_notes";
}

function TweetsCollectionModalBody({
  generatedTwitterTweets,
  onGeneratedTwitterTweetsChange,
  onTweetFavoritedForCollect,
}: {
  generatedTwitterTweets: TweetItem[] | null;
  onGeneratedTwitterTweetsChange: (tweets: TweetItem[]) => void;
  onTweetFavoritedForCollect?: (tweetText: string) => "added" | "duplicate";
}) {
  const tweets = generatedTwitterTweets ?? [];
  const subtitle = useMemo(() => `${tweets.length} tweets`, [tweets.length]);

  return (
    <>
      <p className="sr-only">{subtitle}</p>
      {tweets.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-muted/70">No tweets generated yet.</p>
      ) : (
        <TweetsCollectionTable
          tweets={tweets}
          onTweetsChange={onGeneratedTwitterTweetsChange}
          onTweetFavorited={onTweetFavoritedForCollect}
        />
      )}
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
          generatedTwitterTweets={generatedTwitterTweets}
          onGeneratedTwitterTweetsChange={onGeneratedTwitterTweetsChange}
          onTweetFavoritedForCollect={onTweetFavoritedForCollect}
        />
      </CenteredOverlayModal>
    );
  }

  const individualContent = card?.kind === "individual" ? card.content : undefined;

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
      {individualContent ? (
        <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90 dark:text-white/88">
          {individualContent}
        </div>
      ) : card?.error ? (
        <p className="text-[14px] leading-relaxed text-[#e5484d]/85">{card.error}</p>
      ) : (
        <p className="text-[14px] leading-relaxed text-muted/70">No generated content yet.</p>
      )}
    </CenteredOverlayModal>
  );
}
