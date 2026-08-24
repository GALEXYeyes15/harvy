import type { MediumPostResult } from "../../server/mediumArchive";
import type { YoutubeVideoResult } from "../../server/youtubeArchive";
import {
  formatCompactCount,
  formatOutlierMultiple,
  formatPostedAgo,
  type OutlierPost,
} from "./outlierPosts";

function scoreByPrimaryMetric(
  raw: Array<{ id: string; primary: number; toPost: (multiple: number) => OutlierPost }>,
  sourceId: string,
): OutlierPost[] {
  const metrics = raw.map((row) => Math.max(0, row.primary));
  const total = metrics.reduce((sum, n) => sum + n, 0);
  const average = metrics.length > 0 ? total / metrics.length : 0;

  return raw.map((row, index) => {
    const primary = metrics[index] ?? 0;
    const multiple = average > 0 ? primary / average : 0;
    const post = row.toPost(multiple);
    return {
      ...post,
      id: `${sourceId}:${post.id}`,
      sourceId,
    };
  });
}

export function scoreMediumPosts(raw: MediumPostResult[], sourceId: string): OutlierPost[] {
  return scoreByPrimaryMetric(
    raw.map((post) => ({
      id: post.id,
      primary: post.claps,
      toPost: (multiple) => {
        const hasThumbnail = Boolean(post.coverImage);
        const preview = post.preview.trim() || post.title;
        return {
          id: post.id,
          sourceId,
          creatorName: post.creatorName,
          creatorPhotoUrl: post.creatorPhotoUrl ?? null,
          handle: post.handle,
          platform: "Medium",
          postedAgo: formatPostedAgo(post.postDate),
          postDateIso: post.postDate,
          preview,
          likes: formatCompactCount(post.claps),
          likesCount: post.claps,
          comments: formatCompactCount(post.responses),
          commentsCount: post.responses,
          restacks: "—",
          restacksCount: 0,
          views: "—",
          outlierMultiple: formatOutlierMultiple(multiple),
          outlierMultipleValue: multiple,
          hasThumbnail,
          thumbnailUrl: post.coverImage,
          thumbnailTone: hasThumbnail ? "warm" : undefined,
          thumbnailHeight: hasThumbnail ? "short" : undefined,
          captionBelowThumbnail: post.title !== preview ? post.title : undefined,
          canonicalUrl: post.canonicalUrl,
        };
      },
    })),
    sourceId,
  );
}

export function scoreYoutubeVideos(raw: YoutubeVideoResult[], sourceId: string): OutlierPost[] {
  return scoreByPrimaryMetric(
    raw.map((video) => ({
      id: video.id,
      primary: video.views,
      toPost: (multiple) => {
        const hasThumbnail = Boolean(video.coverImage);
        const preview = video.preview.trim() || video.title;
        return {
          id: video.id,
          sourceId,
          creatorName: video.creatorName,
          creatorPhotoUrl: video.creatorPhotoUrl ?? null,
          handle: video.handle,
          platform: "YouTube",
          postedAgo: formatPostedAgo(video.postDate),
          postDateIso: video.postDate,
          preview,
          likes: formatCompactCount(video.likes),
          likesCount: video.likes,
          comments: formatCompactCount(video.comments),
          commentsCount: video.comments,
          restacks: "—",
          restacksCount: 0,
          views: formatCompactCount(video.views),
          outlierMultiple: formatOutlierMultiple(multiple),
          outlierMultipleValue: multiple,
          hasThumbnail,
          thumbnailUrl: video.coverImage,
          thumbnailTone: hasThumbnail ? "cool" : undefined,
          thumbnailHeight: hasThumbnail ? "short" : undefined,
          captionBelowThumbnail: video.title !== preview ? video.title : undefined,
          canonicalUrl: video.canonicalUrl,
        };
      },
    })),
    sourceId,
  );
}
