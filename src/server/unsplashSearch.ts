import { UNSPLASH_MISSING_KEY_MESSAGE } from "../features/editor/unsplashErrors";

export type UnsplashImageResult = {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
};

type UnsplashApiPhoto = {
  id: string;
  alt_description?: string | null;
  description?: string | null;
  urls?: {
    small?: string;
    thumb?: string;
    regular?: string;
    full?: string;
  };
  links?: {
    html?: string;
  };
  user?: {
    name?: string;
    links?: {
      html?: string;
    };
  };
};

function mapPhoto(photo: UnsplashApiPhoto): UnsplashImageResult | null {
  const thumbUrl =
    photo.urls?.small ?? photo.urls?.thumb ?? photo.urls?.regular ?? "";
  const fullUrl =
    photo.urls?.regular ?? photo.urls?.full ?? thumbUrl;
  if (!thumbUrl || !fullUrl) return null;

  const photographer = photo.user?.name?.trim() ?? "";
  if (!photographer) return null;

  return {
    id: photo.id,
    thumbUrl,
    fullUrl,
    alt:
      photo.alt_description?.trim() ||
      photo.description?.trim() ||
      "Unsplash photo",
    photographer,
    photographerUrl: photo.user?.links?.html ?? "https://unsplash.com",
    unsplashUrl: photo.links?.html ?? "https://unsplash.com",
  };
}

export async function searchUnsplashPhotos(query: string): Promise<UnsplashImageResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter a search term.");
  }

  const apiKey = process.env.UNSPLASH_ACCESS_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error(UNSPLASH_MISSING_KEY_MESSAGE);
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", trimmed);
  url.searchParams.set("per_page", "12");

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${apiKey}`,
      "Accept-Version": "v1",
    },
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    let message = `Unsplash request failed (${response.status})`;
    if (detail) {
      try {
        const parsed = JSON.parse(detail) as { errors?: string[] };
        const first = parsed.errors?.[0]?.trim();
        if (first) message = `Unsplash request failed (${response.status}): ${first}`;
        else message = `Unsplash request failed (${response.status}): ${detail}`;
      } catch {
        message = `Unsplash request failed (${response.status}): ${detail}`;
      }
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as { results?: UnsplashApiPhoto[] };
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.map(mapPhoto).filter((item): item is UnsplashImageResult => item != null);
}
