export type RelatedEssayLinkRequest = {
  path: string;
  url: string;
};

type RelatedEssayLinkingRef = {
  onLinkEssay: (request: RelatedEssayLinkRequest) => void;
};

export const relatedEssayLinkingRef: RelatedEssayLinkingRef = {
  onLinkEssay: () => {},
};

export function syncRelatedEssayLinkingRef(partial: Partial<RelatedEssayLinkingRef>): void {
  Object.assign(relatedEssayLinkingRef, partial);
}
