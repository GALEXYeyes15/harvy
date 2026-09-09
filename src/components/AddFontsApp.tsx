import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
  Search,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { emitFontsCatalogChanged } from "../features/fonts/addFontsPopout";
import {
  FEELING_FILTERS,
  FEELING_PREVIEW_FONTS,
  filterGoogleFontsCatalog,
  loadGoogleFontsCatalog,
  type FeelingFilterId,
  type GoogleFontsCatalogEntry,
  type GoogleFontsSort,
} from "../features/fonts/googleFontsCatalog";
import { isMacOSPlatform, isTauriRuntime } from "../features/save/saveRuntime";
import { setupWindowDragRegions } from "../features/window/setupWindowDragRegions";
import {
  APPEARANCE_FONTS_CHANGED_EVENT,
  findBuiltinFontByGoogleFamily,
  notifyAppearanceFontsChanged,
} from "../theme/appearanceFonts";
import {
  applyAppearanceStyle,
  readStoredAppearanceStyleId,
} from "../theme/appearanceStyles";
import {
  addUserAppearanceFont,
  ensureGoogleFontStylesheet,
  isUserFontAdded,
  readUserAppearanceFonts,
  removeUserAppearanceFont,
  USER_APPEARANCE_FONTS_KEY,
  type UserAppearanceFont,
} from "../theme/userAppearanceFonts";
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
}

const PAGE_SIZE = 36;
const PREVIEW =
  "Everyone has the right to freedom of thought, conscience and religion…";

const SORT_OPTIONS: Array<{ id: GoogleFontsSort; label: string }> = [
  { id: "popularity", label: "Popularity" },
  { id: "trending", label: "Trending" },
  { id: "name", label: "Name" },
  { id: "date", label: "Newest" },
];

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function SidebarSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-[#e8eaed]/90">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function FeelingChip({
  feeling,
  active,
  onClick,
}: {
  feeling: FeelingFilterId;
  active: boolean;
  onClick: () => void;
}) {
  const previewFamily = FEELING_PREVIEW_FONTS[feeling];

  useEffect(() => {
    ensureGoogleFontStylesheet(previewFamily);
  }, [previewFamily]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[2.35rem] items-center justify-center rounded-lg px-2 py-2 text-center text-[13px] leading-tight transition-colors ${
        active
          ? "bg-[#8ab4f8] text-[#202124]"
          : "bg-[#303134] text-[#e8eaed] hover:bg-[#3c4043]"
      }`}
      style={{ fontFamily: `"${previewFamily}", sans-serif` }}
    >
      <span className="inline-flex items-center gap-1">
        {active ? <Check size={12} strokeWidth={2.75} aria-hidden /> : null}
        {feeling === "Excited" ? "EXCITED" : feeling}
      </span>
    </button>
  );
}

function FontRow({
  font,
  added,
  builtin,
  view,
  onAdd,
  onRemove,
}: {
  font: GoogleFontsCatalogEntry;
  added: boolean;
  builtin: boolean;
  view: "row" | "grid";
  onAdd: () => void;
  onRemove?: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        ensureGoogleFontStylesheet(font.family);
        setLoaded(true);
        observer.disconnect();
      },
      { rootMargin: "160px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [font.family]);

  const designer =
    font.designers.length > 0 ? font.designers.slice(0, 2).join(", ") : null;
  const stylesLabel = `${font.styleCount} style${font.styleCount === 1 ? "" : "s"}`;

  if (view === "grid") {
    return (
      <div
        ref={rowRef}
        className="group flex flex-col rounded-2xl bg-[#1e1f20] p-4 ring-1 ring-white/[0.04] transition-colors hover:bg-[#28292a]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[#e8eaed]">{font.family}</p>
            <p className="mt-0.5 truncate text-[12px] text-[#9aa0a6]">
              {stylesLabel}
              {designer ? ` · ${designer}` : ""}
            </p>
          </div>
          <FontAction
            builtin={builtin}
            added={added}
            onAdd={onAdd}
            onRemove={onRemove}
            compact
          />
        </div>
        <p
          className="mt-4 line-clamp-3 text-[28px] leading-[1.15] tracking-[-0.01em] text-[#e8eaed]"
          style={loaded ? { fontFamily: `"${font.family}", sans-serif` } : undefined}
        >
          {PREVIEW}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      className="group rounded-2xl px-4 py-5 transition-colors hover:bg-[#1e1f20]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
            <span className="font-medium text-[#e8eaed]">{font.family}</span>
            <span className="text-[#9aa0a6]">{stylesLabel}</span>
            {designer ? <span className="text-[#9aa0a6]">{designer}</span> : null}
          </div>
          <div className="mt-3 h-px w-full bg-white/[0.06]" />
        </div>
        <FontAction builtin={builtin} added={added} onAdd={onAdd} onRemove={onRemove} />
      </div>
      <p
        className="mt-4 truncate text-[40px] leading-[1.2] tracking-[-0.015em] text-[#e8eaed]"
        style={loaded ? { fontFamily: `"${font.family}", sans-serif` } : undefined}
      >
        {PREVIEW}
      </p>
    </div>
  );
}

function FontAction({
  builtin,
  added,
  onAdd,
  onRemove,
  compact = false,
}: {
  builtin: boolean;
  added: boolean;
  onAdd: () => void;
  onRemove?: () => void;
  compact?: boolean;
}) {
  if (builtin) {
    return (
      <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-[#9aa0a6]">
        Built-in
      </span>
    );
  }
  if (added) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#8ab4f8]/15 px-2.5 py-1 text-[12px] text-[#8ab4f8]">
          <Check size={12} strokeWidth={2.5} aria-hidden />
          Added
        </span>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove font"
            className="rounded-full p-1.5 text-[#9aa0a6] opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-[#e8eaed] group-hover:opacity-100"
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-[#8ab4f8] font-medium text-[#202124] hover:bg-[#aecbfa] ${
        compact ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[12px]"
      }`}
    >
      <Plus size={13} strokeWidth={2.25} aria-hidden />
      Add
    </button>
  );
}

/**
 * In-app Google Fonts browser — layout inspired by fonts.google.com.
 */
export function AddFontsApp() {
  const [query, setQuery] = useState("");
  const [feelings, setFeelings] = useState<string[]>([]);
  const [sort, setSort] = useState<GoogleFontsSort>("popularity");
  const [view, setView] = useState<"row" | "grid">("row");
  const [catalog, setCatalog] = useState<GoogleFontsCatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userFonts, setUserFonts] = useState<UserAppearanceFont[]>(() =>
    readUserAppearanceFonts(),
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const macOverlay = isTauriRuntime() && isMacOSPlatform();

  const refreshUserFonts = () => setUserFonts(readUserAppearanceFonts());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => applyTheme(readStoredThemeMode(), mq.matches);
    syncTheme();
    mq.addEventListener("change", syncTheme);
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === "harvy-theme" ||
        event.key === "harvy-style" ||
        event.key === "harvy:appearance-styles:v1"
      ) {
        syncTheme();
      }
      if (event.key === USER_APPEARANCE_FONTS_KEY) refreshUserFonts();
    };
    const onFontsChanged = () => refreshUserFonts();
    window.addEventListener("storage", onStorage);
    window.addEventListener(APPEARANCE_FONTS_CHANGED_EVENT, onFontsChanged);
    return () => {
      mq.removeEventListener("change", syncTheme);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APPEARANCE_FONTS_CHANGED_EVENT, onFontsChanged);
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
    let cancelled = false;
    void (async () => {
      try {
        const fonts = await loadGoogleFontsCatalog();
        if (!cancelled) {
          setCatalog(fonts);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "Could not load Google Fonts.";
          setError(message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, feelings, sort]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    return filterGoogleFontsCatalog(catalog, {
      query,
      feelings,
      sort,
    });
  }, [catalog, query, feelings, sort]);

  const visible = filtered.slice(0, visibleCount);
  const hasFilters = feelings.length > 0;

  function handleAdd(font: GoogleFontsCatalogEntry) {
    if (findBuiltinFontByGoogleFamily(font.family)) return;
    addUserAppearanceFont({ family: font.family, category: font.category });
    refreshUserFonts();
    notifyAppearanceFontsChanged();
    void emitFontsCatalogChanged();
  }

  function handleRemove(id: string) {
    removeUserAppearanceFont(id);
    refreshUserFonts();
    notifyAppearanceFontsChanged();
    void emitFontsCatalogChanged();
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#131314] text-[#e8eaed] antialiased">
      <div
        className="harvy-title-bar-drag h-8 w-full shrink-0"
        data-harvy-window-drag
        data-tauri-drag-region
      />

      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="flex w-[17rem] shrink-0 flex-col border-r border-white/[0.06] bg-[#131314]">
          <div className="px-4 pb-3 pt-1" data-harvy-window-drag>
            <p className="text-[15px] font-medium tracking-tight text-[#e8eaed]">
              Google Fonts
            </p>
            <p className="mt-0.5 text-[12px] text-[#9aa0a6]">Add to Harvy</p>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
            <SidebarSection
              title="Feeling"
              icon={<Smile size={14} strokeWidth={2} className="text-[#9aa0a6]" aria-hidden />}
            >
              <div className="grid grid-cols-2 gap-2">
                {FEELING_FILTERS.map((feeling) => (
                  <FeelingChip
                    key={feeling}
                    feeling={feeling}
                    active={feelings.includes(feeling)}
                    onClick={() => setFeelings((prev) => toggleValue(prev, feeling))}
                  />
                ))}
              </div>
            </SidebarSection>

            {userFonts.length > 0 ? (
              <SidebarSection title="Your fonts">
                <div className="flex flex-wrap gap-1.5">
                  {userFonts.map((font) => (
                    <span
                      key={font.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#303134] px-2.5 py-1 text-[12px] text-[#e8eaed]"
                      style={{ fontFamily: `"${font.family}", sans-serif` }}
                    >
                      <span className="truncate">{font.label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove(font.id)}
                        aria-label={`Remove ${font.label}`}
                        className="rounded-full p-0.5 text-[#9aa0a6] hover:text-[#e8eaed]"
                      >
                        <X size={12} strokeWidth={2} aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              </SidebarSection>
            ) : null}
          </div>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 space-y-3 border-b border-white/[0.06] px-6 pb-4 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative min-w-[16rem] flex-1">
                <Search
                  size={16}
                  strokeWidth={2}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa0a6]"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search fonts"
                  className="w-full rounded-full border-0 bg-[#303134] py-2.5 pl-10 pr-4 text-[14px] text-[#e8eaed] outline-none ring-1 ring-transparent placeholder:text-[#9aa0a6] focus:ring-[#8ab4f8]/50"
                />
              </label>

              <label className="relative shrink-0">
                <span className="sr-only">Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as GoogleFontsSort)}
                  className="appearance-none rounded-full bg-[#303134] py-2.5 pl-3.5 pr-9 text-[13px] text-[#e8eaed] outline-none ring-1 ring-transparent focus:ring-[#8ab4f8]/50"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      Sort by {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6]"
                  aria-hidden
                />
              </label>

              <div className="flex shrink-0 overflow-hidden rounded-full bg-[#303134] p-0.5">
                <button
                  type="button"
                  onClick={() => setView("row")}
                  aria-pressed={view === "row"}
                  aria-label="Row view"
                  className={`rounded-full p-2 ${
                    view === "row" ? "bg-[#8ab4f8] text-[#202124]" : "text-[#9aa0a6]"
                  }`}
                >
                  <List size={15} strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  aria-label="Grid view"
                  className={`rounded-full p-2 ${
                    view === "grid" ? "bg-[#8ab4f8] text-[#202124]" : "text-[#9aa0a6]"
                  }`}
                >
                  <LayoutGrid size={15} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>

            {hasFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#8ab4f8]/15 px-2.5 py-1 text-[12px] font-medium text-[#8ab4f8]">
                  Filters
                </span>
                {feelings.map((feeling) => (
                  <button
                    key={feeling}
                    type="button"
                    onClick={() => setFeelings((prev) => toggleValue(prev, feeling))}
                    className="inline-flex items-center gap-1 rounded-full bg-[#8ab4f8] px-2.5 py-1 text-[12px] text-[#202124]"
                  >
                    Feeling — {feeling}
                    <X size={12} strokeWidth={2.25} aria-hidden />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFeelings([])}
                  className="px-1 text-[12px] text-[#8ab4f8] hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>

          <div
            ref={listRef}
            className="relative min-h-0 flex-1 overflow-y-auto px-4 py-2"
            onScroll={(event) => {
              setShowScrollTop(event.currentTarget.scrollTop > 400);
            }}
          >
            {error ? (
              <p className="py-16 text-center text-[14px] text-[#9aa0a6]">{error}</p>
            ) : !catalog ? (
              <p className="py-16 text-center text-[14px] text-[#9aa0a6]">
                Loading Google Fonts…
              </p>
            ) : visible.length === 0 ? (
              <p className="py-16 text-center text-[14px] text-[#9aa0a6]">No fonts match.</p>
            ) : (
              <>
                <div
                  className={
                    view === "grid"
                      ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                      : "divide-y divide-white/[0.04]"
                  }
                >
                  {visible.map((font) => {
                    const builtin = Boolean(findBuiltinFontByGoogleFamily(font.family));
                    const added = builtin || isUserFontAdded(font.family);
                    const user = userFonts.find(
                      (row) => row.family.toLowerCase() === font.family.toLowerCase(),
                    );
                    return (
                      <FontRow
                        key={font.family}
                        font={font}
                        builtin={builtin}
                        added={added}
                        view={view}
                        onAdd={() => handleAdd(font)}
                        onRemove={user ? () => handleRemove(user.id) : undefined}
                      />
                    );
                  })}
                </div>
                {visibleCount < filtered.length ? (
                  <div className="py-8 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                      className="rounded-full bg-[#303134] px-4 py-2 text-[13px] text-[#e8eaed] hover:bg-[#3c4043]"
                    >
                      Show more ({filtered.length - visibleCount} left)
                    </button>
                  </div>
                ) : (
                  <div className="h-8" />
                )}
              </>
            )}
          </div>

          {showScrollTop ? (
            <button
              type="button"
              onClick={() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Scroll to top"
              className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#303134] text-[#e8eaed] shadow-lg ring-1 ring-white/10 hover:bg-[#3c4043]"
            >
              <ArrowUp size={18} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </main>
      </div>
    </div>
  );
}
