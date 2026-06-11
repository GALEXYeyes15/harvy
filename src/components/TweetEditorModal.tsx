import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";
import type { TweetItem } from "../features/format/tweetCollection";

type TweetEditorModalProps = {
  open: boolean;
  tweet: TweetItem | null;
  onClose: () => void;
  onSave: (tweetId: string, text: string) => void;
};

export function TweetEditorModal({ open, tweet, onClose, onSave }: TweetEditorModalProps) {
  if (!tweet) return null;

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title="Edit tweet"
      titleId="harvy-tweet-editor-modal-title"
      backdropLabel="Close tweet editor"
      closeLabel="Close tweet editor"
      maxWidthClass="max-w-[min(640px,calc(100vw-3rem))]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-6 py-5"
      autoFocusCloseButton={false}
      zIndexClass="z-[210]"
    >
      <TweetEditorForm
        key={tweet.id}
        tweet={tweet}
        onCancel={onClose}
        onSave={(text) => {
          onSave(tweet.id, text);
          onClose();
        }}
      />
    </CenteredOverlayModal>
  );
}

function TweetEditorForm({
  tweet,
  onCancel,
  onSave,
}: {
  tweet: TweetItem;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const text = new FormData(event.currentTarget).get("text");
        if (typeof text === "string" && text.trim()) {
          onSave(text.trim());
        }
      }}
    >
      <label htmlFor="harvy-tweet-editor-text" className="sr-only">
        Tweet text
      </label>
      <textarea
        id="harvy-tweet-editor-text"
        name="text"
        defaultValue={tweet.text}
        rows={6}
        className="w-full resize-y rounded-lg border-0 bg-canvas/45 px-3.5 py-3 text-[14px] leading-relaxed text-ink placeholder:text-muted/65 focus:outline-none focus:ring-1 focus:ring-line/30 dark:bg-canvas/30"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted/80 transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-ink px-4 py-2 text-[13px] font-medium text-page transition-opacity hover:opacity-90 dark:bg-white dark:text-ink"
        >
          Save
        </button>
      </div>
    </form>
  );
}
