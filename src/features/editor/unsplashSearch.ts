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

export async function searchUnsplashPhotos(query: string): Promise<UnsplashImageResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter a search term.");
  }

  try {
    if (isTauriRuntime()) {
      if (import.meta.env.DEV) {
        console.debug("[harvy] Unsplash search via Tauri command");
      }
      return await invoke<UnsplashImageResult[]>("search_unsplash_photos", { query: trimmed });
    }

    if (import.meta.env.DEV) {
      console.debug("[harvy] Unsplash search via Vite API");
    }
    const base = unsplashApiBase();
    const url = `${base}/api/unsplash/search?q=${encodeURIComponent(trimmed)}`;
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

export { UNSPLASH_MISSING_KEY_MESSAGE };
