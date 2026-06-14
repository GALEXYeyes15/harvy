import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import {
  formatUnsplashSearchError,
  invokeErrorMessage,
  logUnsplashDebug,
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

function raiseUnsplashError(error: unknown): never {
  const message = formatUnsplashSearchError(invokeErrorMessage(error));
  logUnsplashDebug(message);
  throw new Error(message);
}

export async function searchUnsplashPhotos(query: string): Promise<UnsplashImageResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter a search term.");
  }

  if (isTauriRuntime()) {
    logUnsplashDebug(`Searching via Tauri command for "${trimmed}"`);
    try {
      return await invoke<UnsplashImageResult[]>("search_unsplash_photos", { query: trimmed });
    } catch (error) {
      raiseUnsplashError(error);
    }
  }

  logUnsplashDebug(`Searching via Vite API for "${trimmed}"`);
  const base = unsplashApiBase();
  const url = `${base}/api/unsplash/search?q=${encodeURIComponent(trimmed)}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    raiseUnsplashError(error);
  }

  if (!response.ok) {
    const detail = (await response.text()).trim();
    raiseUnsplashError(
      detail || `Unsplash search failed (${response.status} ${response.statusText})`,
    );
  }

  try {
    const payload = (await response.json()) as { results?: UnsplashImageResult[] };
    return Array.isArray(payload.results) ? payload.results : [];
  } catch (error) {
    raiseUnsplashError(error);
  }
}
