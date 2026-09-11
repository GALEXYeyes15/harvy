export type RelatedEssayLinkRequest = {
  path: string;
  url: string;
  start?: number;
  end?: number;
};

type RelatedEssayLinkingRef = {
  onLinkEssay: (request: RelatedEssayLinkRequest) => void;
  urlForPath: (path: string) => string;
  resolveUrl: (path: string, title?: string) => Promise<string>;
  applyLink: (from: number, to: number, href: string) => boolean;
};

export const relatedEssayLinkingRef: RelatedEssayLinkingRef = {
  onLinkEssay: () => {},
  urlForPath: () => "",
  resolveUrl: async () => "",
  applyLink: () => false,
};

export function syncRelatedEssayLinkingRef(partial: Partial<RelatedEssayLinkingRef>): void {
  Object.assign(relatedEssayLinkingRef, partial);
}
