import { DEFAULT_UNSPLASH_URL } from "./harvyImageAttribution";

export type MockUnsplashImage = {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
};

/** Sample thumbnails for the Unsplash tab until API integration exists. */
export const MOCK_UNSPLASH_IMAGES: MockUnsplashImage[] = [
  {
    id: "u1",
    thumbUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=320&h=200&fit=crop",
    fullUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&fit=crop",
    alt: "Snowy mountain range",
    photographer: "Benjamin Voros",
    photographerUrl: "https://unsplash.com/@benjaminvoros",
    unsplashUrl: DEFAULT_UNSPLASH_URL,
  },
  {
    id: "u2",
    thumbUrl: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=320&h=200&fit=crop",
    fullUrl: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&fit=crop",
    alt: "Sunlit forest valley",
    photographer: "Luca Bravo",
    photographerUrl: "https://unsplash.com/@lucabravo",
    unsplashUrl: DEFAULT_UNSPLASH_URL,
  },
  {
    id: "u3",
    thumbUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=320&h=200&fit=crop",
    fullUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&fit=crop",
    alt: "Fog over lake and pines",
    photographer: "Luca Bravo",
    photographerUrl: "https://unsplash.com/@lucabravo",
    unsplashUrl: DEFAULT_UNSPLASH_URL,
  },
  {
    id: "u4",
    thumbUrl: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=320&h=200&fit=crop",
    fullUrl: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&fit=crop",
    alt: "Green meadow wildflowers",
    photographer: "Aaron Burden",
    photographerUrl: "https://unsplash.com/@aaronburden",
    unsplashUrl: DEFAULT_UNSPLASH_URL,
  },
  {
    id: "u5",
    thumbUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=320&h=200&fit=crop",
    fullUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&fit=crop",
    alt: "Desert road at dusk",
    photographer: "Wenniel Lun",
    photographerUrl: "https://unsplash.com/@wennielun",
    unsplashUrl: DEFAULT_UNSPLASH_URL,
  },
  {
    id: "u6",
    thumbUrl: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=320&h=200&fit=crop",
    fullUrl: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1200&fit=crop",
    alt: "Ocean waves on sand",
    photographer: "Nikola Johnny Mirkovic",
    photographerUrl: "https://unsplash.com/@nikolajohnnymirkovic",
    unsplashUrl: DEFAULT_UNSPLASH_URL,
  },
];

export function searchMockUnsplash(query: string): MockUnsplashImage[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_UNSPLASH_IMAGES;
  return MOCK_UNSPLASH_IMAGES.filter(
    (img) =>
      img.alt.toLowerCase().includes(q) ||
      img.photographer.toLowerCase().includes(q) ||
      img.id.includes(q),
  );
}
