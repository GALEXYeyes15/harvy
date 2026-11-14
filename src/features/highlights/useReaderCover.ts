import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { isTauriRuntime } from "../save/saveRuntime";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Object URLs by Reader-relative path, shared by every card for the life of the window. */
const cache = new Map<string, Promise<string | null>>();

function loadCover(path: string): Promise<string | null> {
  let pending = cache.get(path);
  if (!pending) {
    pending = invoke<ArrayBuffer>("read_reader_cover", { path })
      .then((bytes) => {
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const blob = new Blob([bytes], { type: MIME[ext] ?? "application/octet-stream" });
        return URL.createObjectURL(blob);
      })
      .catch(() => {
        // Missing or unreadable; let a later reload try again.
        cache.delete(path);
        return null;
      });
    cache.set(path, pending);
  }
  return pending;
}

/** Object URL for a cover named in Reader's highlights index, or null while loading / missing. */
export function useReaderCover(path: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!path || !isTauriRuntime()) return;
    let cancelled = false;
    void loadCover(path).then((next) => {
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}
