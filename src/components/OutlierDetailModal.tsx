import {
  ArrowUpRight,
  Heart,
  MessageCircle,
  Repeat2,
  Share,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  fetchSubstackComments,
  parseSubstackSourceRef,
  type SubstackComment,
} from "../features/outliers/fetchSubstackComments";
import {
  formatCompactCount,
  formatOutlierTimestamp,
  formatPostedAgo,
  type OutlierPost,
} from "../features/outliers/outlierPosts";
import {
  isSubstackNoteDoc,
  SubstackNoteBody,
} from "../features/outliers/substackNoteBody";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type OutlierDetailModalProps = {
  open: boolean;
  post: OutlierPost | null;
  onClose: () => void;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

function Avatar({
  name,
  photoUrl,
  sizeClass = "h-9 w-9 text-[12px]",
}: {
  name: string;
  photoUrl?: string | null;
  sizeClass?: string;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-ink/[0.08] font-semibold text-ink/70 dark:bg-white/[0.08] dark:text-white/70`}
      aria-hidden
    >
      {initialsFromName(name)}
    </div>
  );
}

function EngagementButton({
  icon,
  label,
  active,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] tabular-nums ${
        active ? "text-[#ff6719]" : "text-muted/60 dark:text-white/45"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function CommentThread({
  comment,
  depth = 0,
}: {
  comment: SubstackComment;
  depth?: number;
}) {
  return (
    <div className={depth > 0 ? "mt-4 pl-3" : ""}>
      <div className="flex gap-3">
        <Avatar
          name={comment.authorName}
          photoUrl={comment.photoUrl}
          sizeClass="h-8 w-8 text-[11px]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-[14px] font-semibold text-ink">{comment.authorName}</p>
            {comment.date ? (
              <p className="text-[12px] text-muted/50 dark:text-white/35">
                {formatPostedAgo(comment.date)}
              </p>
            ) : null}
          </div>
          {isSubstackNoteDoc(comment.bodyJson) ? (
            <div className="mt-1">
              <SubstackNoteBody
                doc={comment.bodyJson}
                className="min-w-0 break-words space-y-2 text-[14px] leading-relaxed text-ink/90 dark:text-white/86 [overflow-wrap:anywhere]"
              />
            </div>
          ) : (
            <p className="mt-1 break-words whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90 dark:text-white/86 [overflow-wrap:anywhere]">
              {comment.body}
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-4">
            <EngagementButton
              active={comment.likes > 0}
              icon={
                <Heart
                  size={14}
                  strokeWidth={1.75}
                  fill={comment.likes > 0 ? "currentColor" : "none"}
                  aria-hidden
                />
              }
              label={comment.likes > 0 ? formatCompactCount(comment.likes) : ""}
            />
            <span className="text-muted/45 dark:text-white/30">
              <MessageCircle size={14} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-muted/45 dark:text-white/30">
              <Repeat2 size={14} strokeWidth={1.75} aria-hidden />
            </span>
          </div>
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <div className="mt-1 border-l border-line/20 pl-2 dark:border-white/[0.08]">
          {comment.replies.map((reply) => (
            <CommentThread key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OutlierDetailModal({ open, post, onClose }: OutlierDetailModalProps) {
  const [comments, setComments] = useState<SubstackComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !post) {
      setComments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const ref = parseSubstackSourceRef(post);
    if (!ref) {
      setComments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void fetchSubstackComments(ref)
      .then((next) => {
        if (cancelled) return;
        setComments(next);
      })
      .catch((err) => {
        if (cancelled) return;
        setComments([]);
        setError(err instanceof Error ? err.message : "Could not load comments.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, post]);

  if (!post) return null;

  const fullTimestamp = formatOutlierTimestamp(post.postDateIso);
  const likesLabel = `${post.likes} ${post.likesCount === 1 ? "Like" : "Likes"}`;
  const repliesLabel = `${post.comments} ${post.commentsCount === 1 ? "Reply" : "Replies"}`;
  const restacksLabel =
    post.restacksCount > 0
      ? `${post.restacks} ${post.restacksCount === 1 ? "Restack" : "Restacks"}`
      : null;

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title={`${post.creatorName} · ${post.platform}`}
      titleId="harvy-outlier-detail-title"
      titleClassName="sr-only"
      headerClassName="flex shrink-0 items-center justify-end px-3 pt-2.5 pb-0"
      closeButtonClassName="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
      backdropLabel="Close post"
      closeLabel="Close post"
      maxWidthClass="max-w-[min(560px,calc(100vw-3rem))]"
      panelSizeClassName="flex h-[min(820px,90vh)] w-full max-w-[min(560px,calc(100vw-3rem))] max-h-[90vh] min-h-0"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-1"
      panelClassName="dark:bg-[#121212]"
    >
      <div className="space-y-5">
        <header className="flex items-start gap-3">
          <Avatar name={post.creatorName} photoUrl={post.creatorPhotoUrl} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-[15px] font-semibold leading-tight text-ink">
                {post.creatorName}
              </p>
              <p className="text-[13px] text-muted/55 dark:text-white/40">{post.postedAgo}</p>
            </div>
            <p className="mt-0.5 text-[13px] text-muted/60 dark:text-white/45">
              {post.handle ? `${post.handle} · ` : ""}
              {post.platform}
            </p>
          </div>
        </header>

        <div>
          {isSubstackNoteDoc(post.noteBodyJson) ? (
            <SubstackNoteBody
              doc={post.noteBodyJson}
              className="min-w-0 break-words space-y-3 text-[15px] leading-[1.55] text-ink dark:text-white/92 [overflow-wrap:anywhere]"
            />
          ) : (
            <p className="break-words whitespace-pre-wrap text-[15px] leading-[1.55] text-ink dark:text-white/92 [overflow-wrap:anywhere]">
              {post.preview}
            </p>
          )}

          {post.thumbnailUrl ? (
            <div className="mt-4 overflow-hidden rounded-xl">
              <img
                src={post.thumbnailUrl}
                alt=""
                className="h-auto max-h-80 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-5">
          <EngagementButton
            active={post.likesCount > 0}
            icon={
              <Heart
                size={18}
                strokeWidth={1.75}
                fill={post.likesCount > 0 ? "currentColor" : "none"}
                aria-hidden
              />
            }
            label={post.likes}
          />
          <EngagementButton
            icon={<MessageCircle size={18} strokeWidth={1.75} aria-hidden />}
            label={post.comments}
          />
          <EngagementButton
            icon={<Repeat2 size={18} strokeWidth={1.75} aria-hidden />}
            label={post.restacksCount > 0 ? post.restacks : ""}
          />
          {post.canonicalUrl ? (
            <a
              href={post.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[13px] text-muted/60 transition-colors hover:text-ink dark:text-white/45 dark:hover:text-white/80"
            >
              Open on {post.platform}
              <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
            </a>
          ) : (
            <span className="ml-auto text-muted/45 dark:text-white/30">
              <Share size={18} strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </div>

        <div className="border-t border-line/20 pt-3 dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted/55 dark:text-white/40">
            <p>
              {likesLabel}
              <span aria-hidden> · </span>
              {repliesLabel}
              {restacksLabel ? (
                <>
                  <span aria-hidden> · </span>
                  {restacksLabel}
                </>
              ) : null}
            </p>
            {fullTimestamp ? <p>{fullTimestamp}</p> : null}
          </div>
        </div>

        <section aria-labelledby="harvy-outlier-comments-heading" className="pt-1">
          <h3 id="harvy-outlier-comments-heading" className="sr-only">
            Comments
          </h3>

          {isLoading ? (
            <p className="text-[13px] text-muted/65">Loading comments…</p>
          ) : null}
          {error ? <p className="text-[13px] text-muted/75">{error}</p> : null}
          {!isLoading && !error && comments.length === 0 ? (
            <p className="text-[13px] text-muted/65">No replies yet.</p>
          ) : null}

          <div className="space-y-5">
            {comments.map((comment) => (
              <CommentThread key={comment.id} comment={comment} />
            ))}
          </div>
        </section>
      </div>
    </CenteredOverlayModal>
  );
}
