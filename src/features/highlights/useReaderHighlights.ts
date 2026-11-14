import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../save/saveRuntime";
import {
  EMPTY_READER_HIGHLIGHTS,
  parseReaderHighlights,
  type ReaderHighlightsIndex,
} from "./readerHighlights";

export type ReaderHighlightsState = {
  index: ReaderHighlightsIndex;
  /** True until the first read finishes. */
  isLoading: boolean;
  /** Reader hasn't written highlights.json yet. */
  missing: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/**
 * Load Harvy Reader's highlights while `enabled`, and reload whenever the window
 * regains focus — highlight in Reader, switch back to Writer, and it's there.
 */
export function useReaderHighlights(enabled: boolean): ReaderHighlightsState {
  const [index, setIndex] = useState<ReaderHighlightsIndex>(EMPTY_READER_HIGHLIGHTS);
  const [isLoading, setIsLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRawRef = useRef<string | null | undefined>(undefined);
  const inFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (!isTauriRuntime()) {
      setMissing(true);
      setIsLoading(false);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const raw = await invoke<string | null>("read_reader_highlights");
      if (raw === lastRawRef.current) {
        setError(null);
        return;
      }
      if (raw == null) {
        lastRawRef.current = raw;
        setMissing(true);
        setIndex(EMPTY_READER_HIGHLIGHTS);
        setError(null);
        return;
      }
      try {
        const next = parseReaderHighlights(raw);
        lastRawRef.current = raw;
        setMissing(false);
        setIndex(next);
        setError(null);
      } catch {
        // Reader may be mid-write; keep what we have and try again next focus.
        if (lastRawRef.current === undefined) {
          setError("Harvy Reader's highlights file couldn't be read.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    const onFocus = () => void reload();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, reload]);

  return { index, isLoading, missing, error, reload };
}
