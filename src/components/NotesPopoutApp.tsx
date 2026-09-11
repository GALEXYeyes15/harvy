import { useEffect, useState } from "react";
import {
  emitNotesPopoutRequest,
  emitNotesPopoutUpdate,
  listenNotesPopoutState,
} from "../features/notes/notesPopout";
import { handleNotesTextareaTabKey } from "../features/notes/notesTextareaIndent";
import { isMacOSPlatform, isTauriRuntime } from "../features/save/saveRuntime";
import { setupWindowDragRegions } from "../features/window/setupWindowDragRegions";
import {
  applyAppearanceStyle,
  readStoredAppearanceStyleId,
} from "../theme/appearanceStyles";
import { applySystemTypography, SYSTEM_TYPOGRAPHY_KEY } from "../theme/systemTypography";
import {
  applyResolvedTheme,
  readStoredThemeMode,
  resolveTheme,
  type ThemeMode,
} from "../theme/themeMode";

function applyTheme(mode: ThemeMode, systemPrefersDark: boolean) {
  const resolved = resolveTheme(mode, systemPrefersDark);
  applyResolvedTheme(resolved);
  applyAppearanceStyle(readStoredAppearanceStyleId(), resolved);
  applySystemTypography();
}

/**
 * Standalone Notes window shell — majority-of-screen pop-out synced with the main app.
 */
export function NotesPopoutApp() {
  const [notes, setNotes] = useState("");
  const [documentTitle, setDocumentTitle] = useState("Untitled");
  const macOverlay = isTauriRuntime() && isMacOSPlatform();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => applyTheme(readStoredThemeMode(), mq.matches);
    syncTheme();
    mq.addEventListener("change", syncTheme);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "harvy-theme" || event.key === "harvy-style" || event.key === "harvy:appearance-styles:v1" || event.key === SYSTEM_TYPOGRAPHY_KEY) {
        syncTheme();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", syncTheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!macOverlay) return;
    document.documentElement.classList.add("harvy-macos-overlay-titlebar");
    return () => {
      document.documentElement.classList.remove("harvy-macos-overlay-titlebar");
    };
  }, [macOverlay]);

  useEffect(() => setupWindowDragRegions(), []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        unlisten = await listenNotesPopoutState((payload) => {
          setNotes(payload.notes);
          setDocumentTitle(payload.documentTitle.trim() || "Untitled");
          document.title = `Notes — ${payload.documentTitle.trim() || "Untitled"}`;
        });
        if (!cancelled) await emitNotesPopoutRequest();
      } catch (err) {
        console.error("Notes pop-out sync failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-stage text-ink antialiased">
      {/* Overlay title strip blends into stage — no separate system grey bar. */}
      <div
        className="harvy-title-bar-drag h-8 w-full shrink-0"
        data-harvy-window-drag
        data-tauri-drag-region
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-8 pb-8 pt-3">
        <header className="flex shrink-0 items-center gap-2 overflow-visible" data-harvy-window-drag>
          <h1 className="truncate text-[1.375rem] font-semibold leading-snug tracking-[-0.02em] text-ink">
            {documentTitle} Notes
          </h1>
        </header>

        <label htmlFor="harvy-notes-popout" className="sr-only">
          Document notes
        </label>
        <textarea
          id="harvy-notes-popout"
          value={notes}
          onChange={(e) => {
            const next = e.target.value;
            setNotes(next);
            void emitNotesPopoutUpdate({ notes: next });
          }}
          onKeyDown={(e) =>
            handleNotesTextareaTabKey(e, e.currentTarget, (next) => {
              setNotes(next);
              void emitNotesPopoutUpdate({ notes: next });
            })
          }
          placeholder="Ideas, references, reminders…"
          className="mt-6 min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-md border-0 bg-mist px-4 py-3.5 text-[15px] leading-relaxed text-ink focus:outline-none focus:ring-0"
        />
      </div>
    </div>
  );
}
