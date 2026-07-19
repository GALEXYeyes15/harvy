import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import {
  formatUnsplashSearchError,
  logUnsplashSearchFailure,
  UNSPLASH_MISSING_KEY_MESSAGE,
} from "./unsplashErrors";

export type UnsplashImageResult = {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
};

function unsplashApiBase(): string {
  return (
    (import.meta.env.VITE_UNSPLASH_API_BASE as string | undefined)?.replace(/\/$/, "") ?? ""
  );
}

export async function searchUnsplashPhotos(
  query: string,
  opts?: { page?: number; perPage?: number },
): Promise<UnsplashImageResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter a search term.");
  }

  const page = Math.max(1, opts?.page ?? 1);
  const perPage = Math.min(30, Math.max(1, opts?.perPage ?? 12));

  try {
    if (isTauriRuntime()) {
      if (import.meta.env.DEV) {
        console.debug("[harvy] Unsplash search via Tauri command");
      }
      return await invoke<UnsplashImageResult[]>("search_unsplash_photos", {
        query: trimmed,
        page,
        perPage,
      });
    }

    if (import.meta.env.DEV) {
      console.debug("[harvy] Unsplash search via Vite API");
    }
    const base = unsplashApiBase();
    const url = `${base}/api/unsplash/search?q=${encodeURIComponent(trimmed)}&page=${page}&per_page=${perPage}`;
    const response = await fetch(url);
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(detail || `Unsplash search failed (${response.status})`);
    }
    const payload = (await response.json()) as { results?: UnsplashImageResult[] };
    return Array.isArray(payload.results) ? payload.results : [];
  } catch (error) {
    const message = formatUnsplashSearchError(error);
    logUnsplashSearchFailure(message);
    throw new Error(message);
  }
}

/** Popular Unsplash photos for the default popover feed. */
export async function listPopularUnsplashPhotos(opts?: {
  page?: number;
  perPage?: number;
}): Promise<UnsplashImageResult[]> {
  const page = Math.max(1, opts?.page ?? 1);
  const perPage = Math.min(30, Math.max(1, opts?.perPage ?? 12));

  try {
    if (isTauriRuntime()) {
      if (import.meta.env.DEV) {
        console.debug("[harvy] Unsplash popular via Tauri command");
      }
      return await invoke<UnsplashImageResult[]>("list_popular_unsplash_photos", {
        page,
        perPage,
      });
    }

    if (import.meta.env.DEV) {
      console.debug("[harvy] Unsplash popular via Vite API");
    }
    const base = unsplashApiBase();
    const url = `${base}/api/unsplash/popular?page=${page}&per_page=${perPage}`;
    const response = await fetch(url);
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(detail || `Unsplash popular feed failed (${response.status})`);
    }
    const payload = (await response.json()) as { results?: UnsplashImageResult[] };
    return Array.isArray(payload.results) ? payload.results : [];
  } catch (error) {
    const message = formatUnsplashSearchError(error);
    logUnsplashSearchFailure(message);
    throw new Error(message);
  }
}

export { UNSPLASH_MISSING_KEY_MESSAGE };
