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
    throw new Error(
      "Missing Unsplash API key. Add UNSPLASH_ACCESS_KEY to .env.local and restart Harvy.",
    );
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
    throw new Error(
      detail
        ? `Unsplash request failed (${response.status}): ${detail}`
        : `Unsplash request failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as { results?: UnsplashApiPhoto[] };
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.map(mapPhoto).filter((item): item is UnsplashImageResult => item != null);
}
