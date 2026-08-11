import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Minus, Plus, SquareArrowOutUpRight, SquarePen } from "lucide-react";
import { APP_NAME } from "../../lib/constants";
import type { DocumentHeaderPrefs } from "../../features/editor/documentHeaderSettings";
import type { FocusVisibilityPrefs } from "../../features/editor/focusVisibilitySettings";
import {
  type EncouragementPhrase,
  type EncouragementPrefs,
} from "../../features/encouragement/encouragementSettings";
import { formatHotkeyKeys, HOTKEY_GROUPS } from "../../features/settings/hotkeys";
import {
  FK_COMPLEXITY_THRESHOLD_MAX,
  FK_COMPLEXITY_THRESHOLD_MIN,
  READING_WPM_MAX,
  READING_WPM_MIN,
  SUGGESTED_FK_COMPLEXITY_THRESHOLD_MAX,
  SUGGESTED_FK_COMPLEXITY_THRESHOLD_MIN,
  SUGGESTED_READING_WPM_MAX,
  SUGGESTED_READING_WPM_MIN,
  type ParametersPrefs,
} from "../../features/settings/parametersSettings";
import type { ThemeMode, ResolvedTheme } from "../../theme/themeMode";
import {
  APPEARANCE_FONTS_CHANGED_EVENT,
  ensureAllUserAppearanceFontsLoaded,
  ensureAppearanceBodyFontLoaded,
  isUserAppearanceFontsStorageKey,
  listAppearanceBodyFonts,
  resolveAppearanceBodyFont,
  type AppearanceBodyFontId,
} from "../../theme/appearanceFonts";
import { listenFontsCatalogChanged, openAddFontsWindow } from "../../features/fonts/addFontsPopout";
import {
  applyAppearanceStyle,
  CYBER_STYLE_ID,
  CLASSIC_STYLE_ID,
  createBlankCustomStyle,
  deleteCustomAppearanceStyle,
  hasCyberAppearanceOverrides,
  builtInClassicAppearanceStyle,
  readCyberAppearanceStyle,
  readCustomAppearanceStyles,
  resetClassicTypography,
  resetCyberAppearanceStyle,
  resolveStyleBodyFont,
  resolveStyleTypography,
  seedsFromStyle,
  setLiveAppearancePreview,
  STYLE_TYPOGRAPHY_LIMITS,
  styleWithSeeds,
  upsertCustomAppearanceStyle,
  writeClassicTypography,
  writeCyberAppearanceStyle,
  type AppearanceStyleId,
  type CustomAppearanceStyle,
  type StyleBasics,
} from "../../theme/appearanceStyles";
import {
  clampOutliersFetchIntervalMinutes,
  DEFAULT_OUTLIERS_FETCH_INTERVAL_MINUTES,
  OUTLIERS_FETCH_INTERVAL_MAX_MINUTES,
  OUTLIERS_FETCH_INTERVAL_MIN_MINUTES,
  readOutliersSettings,
  writeOutliersSettings,
} from "../../features/outliers/outliersSettings";
import {
  createQuickLink,
  normalizeQuickLink,
  normalizeQuickLinkUrl,
  type QuickLink,
} from "../../features/quick-links/quickLinks";
import {
  loadPersistedQuickLinks,
  QUICK_LINKS_CHANGED_EVENT,
  savePersistedQuickLinks,
} from "../../features/quick-links/quickLinksPersistence";
import { CenteredOverlayModal } from "../overlay/CenteredOverlayModal";
import { CanvaColorPicker } from "./CanvaColorPicker";
import { PhrasesCsvTable } from "./PhrasesCsvTable";
import { SETTINGS_NAV, type SettingsSectionId } from "./sectionIds";


/** macOS System Settings–like window: ~1150×800, capped at 90vw / 90vh. */
const SETTINGS_PANEL_SIZE =
  "h-[min(600px,90vh)] w-[min(600px,90vw)] max-h-[90vh] max-w-[90vw]";

const PHRASES_EXPAND_PANEL_SIZE =
  "h-[min(720px,88vh)] w-[min(960px,92vw)] max-h-[88vh] max-w-[92vw]";

const SETTINGS_DIVIDE_X = "divide-x divide-line/[0.12] dark:divide-[#6f6f6f]";
const SETTINGS_DIVIDE_Y = "divide-y divide-line/[0.12] dark:divide-white/[0.08]";
/** Apple System Settings–style group: solid Boxes (mist) surface. */
const SETTINGS_BOX = `overflow-hidden rounded-xl bg-mist ${SETTINGS_DIVIDE_Y}`;
const SETTINGS_BOX_PAD = "rounded-xl bg-mist px-3.5 py-3";
const SETTINGS_INLINE_INPUT =
  "w-[4.5rem] shrink-0 rounded-md border-0 bg-page px-2 py-1.5 text-right text-[13px] text-ink outline-none ring-1 ring-line/15 focus:ring-[var(--color-focus-ring)]/45";
const SETTINGS_FIELD_INPUT =
  "rounded-md border-0 bg-page px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/15 focus:ring-[var(--color-focus-ring)]/45";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  appearanceStyleId: AppearanceStyleId;
  onAppearanceStyleIdChange: (id: AppearanceStyleId) => void;
  resolvedTheme: ResolvedTheme;
  systemPrefersDark: boolean;
  showQuickLinks: boolean;
  onShowQuickLinksChange: (enabled: boolean) => void;
  spellcheckEnabled: boolean;
  onSpellcheckChange: (enabled: boolean) => void;
  focusVisibilityPrefs: FocusVisibilityPrefs;
  onFocusVisibilityPrefChange: (partial: Partial<FocusVisibilityPrefs>) => void;
  documentHeaderPrefs: DocumentHeaderPrefs;
  onDocumentHeaderPrefChange: (partial: Partial<DocumentHeaderPrefs>) => void;
  enableCollect: boolean;
  onEnableCollectChange: (enabled: boolean) => void;
  showOutliersView: boolean;
  showCollectView: boolean;
  showAvatarView: boolean;
  onShowOutliersViewChange: (enabled: boolean) => void;
  onShowCollectViewChange: (enabled: boolean) => void;
  onShowAvatarViewChange: (enabled: boolean) => void;
  encouragementPrefs: EncouragementPrefs;
  onEncouragementPrefsChange: (partial: Partial<EncouragementPrefs>) => void;
  onTestEncouragement?: () => void;
  parametersPrefs: ParametersPrefs;
  onParametersPrefsChange: (partial: Partial<ParametersPrefs>) => void;
  workspaceRootPath: string | null;
  onChooseWorkspaceFolder?: () => void | Promise<void>;
};

export function SettingsModal({
  open,
  onClose,
  themeMode,
  onThemeModeChange,
  appearanceStyleId,
  onAppearanceStyleIdChange,
  resolvedTheme,
  systemPrefersDark,
  showQuickLinks,
  onShowQuickLinksChange,
  spellcheckEnabled,
  onSpellcheckChange,
  focusVisibilityPrefs,
  onFocusVisibilityPrefChange,
  documentHeaderPrefs,
  onDocumentHeaderPrefChange,
  enableCollect,
  onEnableCollectChange,
  showOutliersView,
  showCollectView,
  showAvatarView,
  onShowOutliersViewChange,
  onShowCollectViewChange,
  onShowAvatarViewChange,
  encouragementPrefs,
  onEncouragementPrefsChange,
  onTestEncouragement,
  parametersPrefs,
  onParametersPrefsChange,
  workspaceRootPath,
  onChooseWorkspaceFolder,
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("editor");

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title="Settings"
      titleId="settings-dialog-title"
      backdropLabel="Dismiss settings"
      closeLabel="Close settings"
      panelSizeClassName={SETTINGS_PANEL_SIZE}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className={`flex min-h-0 min-w-0 flex-1 overflow-hidden ${SETTINGS_DIVIDE_X}`}>
          <nav
            className="flex w-[200px] shrink-0 flex-col gap-0.5 overflow-hidden p-2"
            aria-label="Settings sections"
          >
            {SETTINGS_NAV.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={
                    active
                      ? "rounded-md bg-ink/[0.06] px-2.5 py-2 text-left text-[13px] font-medium text-ink"
                      : "rounded-md px-2.5 py-2 text-left text-[13px] font-normal text-muted/90 transition-colors hover:bg-ink/[0.035] hover:text-ink"
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-5">
            {activeSection === "editor" ? (
              <EditorPanel
                spellcheckEnabled={spellcheckEnabled}
                onSpellcheckChange={onSpellcheckChange}
                focusVisibilityPrefs={focusVisibilityPrefs}
                onFocusVisibilityPrefChange={onFocusVisibilityPrefChange}
                documentHeaderPrefs={documentHeaderPrefs}
                onDocumentHeaderPrefChange={onDocumentHeaderPrefChange}
              />
            ) : null}
            {activeSection === "sidebars" ? (
              <SidebarsPanel
                workspaceRootPath={workspaceRootPath}
                onChooseWorkspaceFolder={onChooseWorkspaceFolder}
                showQuickLinks={showQuickLinks}
                onShowQuickLinksChange={onShowQuickLinksChange}
                parametersPrefs={parametersPrefs}
                onParametersPrefsChange={onParametersPrefsChange}
              />
            ) : null}
            {activeSection === "collect" ? (
              <CollectSettingsPanel
                enableCollect={enableCollect}
                onEnableCollectChange={onEnableCollectChange}
                showOutliersView={showOutliersView}
                showCollectView={showCollectView}
                showAvatarView={showAvatarView}
                onShowOutliersViewChange={onShowOutliersViewChange}
                onShowCollectViewChange={onShowCollectViewChange}
                onShowAvatarViewChange={onShowAvatarViewChange}
              />
            ) : null}
            {activeSection === "appearance" ? (
              <AppearancePanel
                themeMode={themeMode}
                onThemeModeChange={onThemeModeChange}
                appearanceStyleId={appearanceStyleId}
                onAppearanceStyleIdChange={onAppearanceStyleIdChange}
                resolvedTheme={resolvedTheme}
                systemPrefersDark={systemPrefersDark}
              />
            ) : null}
            {activeSection === "shortcuts" ? <HotkeysPanel /> : null}
            {activeSection === "encouragement" ? (
              <EncouragementPanel
                prefs={encouragementPrefs}
                onChange={onEncouragementPrefsChange}
                onTest={onTestEncouragement}
              />
            ) : null}
            {activeSection === "about" ? <SettingsAboutSection /> : null}
          </div>
        </div>
    </CenteredOverlayModal>
  );
}

function SettingsSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
      {description ? (
        <p className="mt-1 text-[12px] leading-relaxed text-muted/90">{description}</p>
      ) : null}
    </div>
  );
}

function SettingsGroup({
  label,
  hint,
  labelStyle = "caps",
  children,
}: {
  label?: string;
  hint?: string;
  /** Caps = existing settings group; italic = page subsection titles from the settings outline. */
  labelStyle?: "caps" | "italic";
  children: ReactNode;
}) {
  return (
    <div>
      {label ? (
        <p
          className={
            labelStyle === "italic"
              ? "mb-2 text-[12px] italic leading-snug text-muted/75"
              : "mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50"
          }
        >
          {label}
        </p>
      ) : null}
      <ul className={SETTINGS_BOX}>
        {children}
      </ul>
      {hint ? <p className="mt-2 text-[11px] leading-snug text-muted/70">{hint}</p> : null}
    </div>
  );
}

function CollectSettingsPanel({
  enableCollect,
  onEnableCollectChange,
  showOutliersView,
  showCollectView,
  showAvatarView,
  onShowOutliersViewChange,
  onShowCollectViewChange,
  onShowAvatarViewChange,
}: {
  enableCollect: boolean;
  onEnableCollectChange: (enabled: boolean) => void;
  showOutliersView: boolean;
  showCollectView: boolean;
  showAvatarView: boolean;
  onShowOutliersViewChange: (enabled: boolean) => void;
  onShowCollectViewChange: (enabled: boolean) => void;
  onShowAvatarViewChange: (enabled: boolean) => void;
}) {
  const [fetchIntervalMinutes, setFetchIntervalMinutes] = useState(
    () => readOutliersSettings().fetchIntervalMinutes,
  );

  const enabledViewCount =
    Number(showOutliersView) + Number(showCollectView) + Number(showAvatarView);

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Research"
        description="Outliers, Ideas, and Avatar in the workspace rail."
      />
      <SettingsGroup hint="Keep at least one Research view on (Outliers, Ideas, or Avatar).">
        <ToggleRow
          id="enable-collect"
          label="Enable Research"
          description="Add Research to the left workspace rail."
          checked={enableCollect}
          onChange={onEnableCollectChange}
        />
        <ToggleRow
          id="show-outliers-view"
          label="Show Outliers"
          description="Creator posts and Notes scored against your average."
          checked={showOutliersView}
          onChange={onShowOutliersViewChange}
          disabled={!enableCollect || (showOutliersView && enabledViewCount === 1)}
        />
        <ToggleRow
          id="show-collect-view"
          label="Show Ideas"
          description="Your table of saved essay ideas."
          checked={showCollectView}
          onChange={onShowCollectViewChange}
          disabled={!enableCollect || (showCollectView && enabledViewCount === 1)}
        />
        <ToggleRow
          id="show-avatar-view"
          label="Show Avatar"
          description="Target audience description you can refer to while writing."
          checked={showAvatarView}
          onChange={onShowAvatarViewChange}
          disabled={!enableCollect || (showAvatarView && enabledViewCount === 1)}
        />
      </SettingsGroup>
      {enableCollect && showOutliersView ? (
        <label className={`flex items-start justify-between gap-4 ${SETTINGS_BOX_PAD}`}>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink">Fetch interval</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
              Minutes between Outliers refreshes after you click Fetch posts. Keeps
              running while Harvy is open. Default {DEFAULT_OUTLIERS_FETCH_INTERVAL_MINUTES}.
            </p>
          </div>
          <input
            type="number"
            min={OUTLIERS_FETCH_INTERVAL_MIN_MINUTES}
            max={OUTLIERS_FETCH_INTERVAL_MAX_MINUTES}
            step={1}
            value={fetchIntervalMinutes}
            onChange={(e) => {
              const next = clampOutliersFetchIntervalMinutes(Number(e.target.value));
              setFetchIntervalMinutes(next);
              writeOutliersSettings({ fetchIntervalMinutes: next });
            }}
            aria-label="Outliers fetch interval in minutes"
            className={SETTINGS_INLINE_INPUT}
          />
        </label>
      ) : null}
    </div>
  );
}

function SidebarsPanel({
  workspaceRootPath,
  onChooseWorkspaceFolder,
  showQuickLinks,
  onShowQuickLinksChange,
  parametersPrefs,
  onParametersPrefsChange,
}: {
  workspaceRootPath: string | null;
  onChooseWorkspaceFolder?: () => void | Promise<void>;
  showQuickLinks: boolean;
  onShowQuickLinksChange: (enabled: boolean) => void;
  parametersPrefs: ParametersPrefs;
  onParametersPrefsChange: (partial: Partial<ParametersPrefs>) => void;
}) {
  const [links, setLinks] = useState<QuickLink[]>(() => loadPersistedQuickLinks());
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    savePersistedQuickLinks(links);
  }, [links]);

  useEffect(() => {
    const sync = () => {
      const next = loadPersistedQuickLinks();
      setLinks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    window.addEventListener(QUICK_LINKS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(QUICK_LINKS_CHANGED_EVENT, sync);
  }, []);

  function handleAdd() {
    const url = normalizeQuickLinkUrl(draftUrl);
    if (!url) {
      setDraftError("Enter a valid http, https, or mailto link.");
      return;
    }
    const next = normalizeQuickLink(createQuickLink({ title: draftTitle, url }));
    setLinks((prev) => [...prev, next]);
    setDraftTitle("");
    setDraftUrl("");
    setDraftError(null);
  }

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Sidebars"
        description="Workspace files, Parameters, Quick Links, and upcoming tools."
      />

      <div>
        <p className="mb-2 text-[12px] italic leading-snug text-muted/75">Left</p>
        <div className={SETTINGS_BOX_PAD}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
            Change files
          </p>
          {workspaceRootPath ? (
            <p className="mt-1 break-all text-[13px] font-medium tracking-tight text-ink">
              {workspaceRootPath}
            </p>
          ) : (
            <p className="mt-1 text-[13px] font-medium tracking-tight text-muted/80">
              No folder selected
            </p>
          )}
          <button
            type="button"
            onClick={() => void onChooseWorkspaceFolder?.()}
            className="mt-3 rounded-md bg-page px-3 py-2 text-[12px] font-medium text-ink ring-1 ring-line/15 transition-colors hover:bg-ink/[0.04]"
          >
            {workspaceRootPath ? "Change folder" : "Choose folder"}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <p className="text-[12px] italic leading-snug text-muted/75">Right</p>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
            Parameters
          </p>
          <ParametersFields prefs={parametersPrefs} onChange={onParametersPrefsChange} />
        </div>

        <SettingsGroup>
          <ToggleRow
            id="enable-ai-check"
            label="Enable AI check"
            description="Coming soon."
            checked={false}
            onChange={() => {}}
            disabled
          />
          <ToggleRow
            id="quick-links"
            label="Quick Links"
            description="Show saved links below Notes."
            checked={showQuickLinks}
            onChange={onShowQuickLinksChange}
          />
        </SettingsGroup>

        {showQuickLinks ? (
          <div className={`space-y-2 ${SETTINGS_BOX_PAD}`}>
            <p className="text-[13px] font-medium text-ink">Saved links</p>
            <p className="text-[11px] leading-snug text-muted/75">
              Add a title and URL. Links open in your browser.
            </p>
            <form
              className="mt-2 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleAdd();
              }}
            >
              <input
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Title"
                className={`w-full ${SETTINGS_FIELD_INPUT}`}
              />
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={draftUrl}
                  onChange={(event) => {
                    setDraftUrl(event.target.value);
                    if (draftError) setDraftError(null);
                  }}
                  placeholder="https://…"
                  required
                  className={`min-w-0 flex-1 ${SETTINGS_FIELD_INPUT}`}
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-ink px-2.5 py-2 text-[12px] font-medium text-page"
                >
                  Add
                </button>
              </div>
              {draftError ? (
                <p className="text-[11px] leading-snug text-[#ff5a5a]">{draftError}</p>
              ) : null}
            </form>

            {links.length === 0 ? (
              <p className="pt-1 text-[12px] text-muted/65">No links yet.</p>
            ) : (
              <ul className={`${SETTINGS_DIVIDE_Y} mt-2 overflow-hidden rounded-lg bg-page/70`}>
                {links.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">{link.title}</p>
                      <p className="truncate text-[11px] text-muted/65">{link.url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLinks((prev) => prev.filter((row) => row.id !== link.id))}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted/75 hover:text-ink"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AppearancePanel({
  themeMode,
  onThemeModeChange,
  appearanceStyleId,
  onAppearanceStyleIdChange,
  resolvedTheme,
  systemPrefersDark,
}: {
  themeMode: ThemeMode;
  onThemeModeChange: (t: ThemeMode) => void;
  appearanceStyleId: AppearanceStyleId;
  onAppearanceStyleIdChange: (id: AppearanceStyleId) => void;
  resolvedTheme: ResolvedTheme;
  systemPrefersDark: boolean;
}) {
  const [customStyles, setCustomStyles] = useState(() => readCustomAppearanceStyles());
  const [cyberStyle, setCyberStyle] = useState(() => readCyberAppearanceStyle());
  const [editor, setEditor] = useState<CustomAppearanceStyle | null>(null);

  const classicResolvedDark =
    themeMode === "dark" || (themeMode === "system" && systemPrefersDark);
  const classicLightSelected =
    appearanceStyleId === CLASSIC_STYLE_ID && !classicResolvedDark;
  const classicDarkSelected =
    appearanceStyleId === CLASSIC_STYLE_ID && classicResolvedDark;

  function selectStyle(id: AppearanceStyleId) {
    onAppearanceStyleIdChange(id);
  }

  function selectClassicLight() {
    // OS-matching Classic stays on system so appearance follows the desktop.
    onThemeModeChange(systemPrefersDark ? "light" : "system");
    onAppearanceStyleIdChange(CLASSIC_STYLE_ID);
  }

  function selectClassicDark() {
    onThemeModeChange(systemPrefersDark ? "system" : "dark");
    onAppearanceStyleIdChange(CLASSIC_STYLE_ID);
  }

  function beginEditing(style: CustomAppearanceStyle) {
    const draft = { ...style, seeds: seedsFromStyle(style) };
    setEditor(draft);
    setLiveAppearancePreview(draft, resolvedTheme);
  }

  function updateEditor(next: CustomAppearanceStyle) {
    setEditor(next);
    setLiveAppearancePreview(next, resolvedTheme);
  }

  function endEditingPreview() {
    setLiveAppearancePreview(null, resolvedTheme);
    applyAppearanceStyle(appearanceStyleId, resolvedTheme);
  }

  function openNewStyle() {
    beginEditing(createBlankCustomStyle());
  }

  function openEditStyle(style: CustomAppearanceStyle) {
    beginEditing(style);
  }

  function openEditCyber() {
    const current = readCyberAppearanceStyle();
    setCyberStyle(current);
    beginEditing(current);
  }

  function openEditClassic() {
    beginEditing(builtInClassicAppearanceStyle());
  }

  function saveEditor() {
    if (!editor) return;
    if (editor.id === CLASSIC_STYLE_ID) {
      writeClassicTypography(resolveStyleTypography(editor));
      setEditor(null);
      setLiveAppearancePreview(null, resolvedTheme);
      onAppearanceStyleIdChange(CLASSIC_STYLE_ID);
      applyAppearanceStyle(CLASSIC_STYLE_ID, resolvedTheme);
      return;
    }
    if (editor.id === CYBER_STYLE_ID) {
      writeCyberAppearanceStyle({
        ...editor,
        id: CYBER_STYLE_ID,
        name: editor.name.trim() || "Cyber",
      });
      const next = readCyberAppearanceStyle();
      setCyberStyle(next);
      setEditor(null);
      setLiveAppearancePreview(null, resolvedTheme);
      onAppearanceStyleIdChange(CYBER_STYLE_ID);
      applyAppearanceStyle(CYBER_STYLE_ID, resolvedTheme);
      return;
    }

    const named = {
      ...editor,
      name: editor.name.trim() || "New theme",
    };
    const next = upsertCustomAppearanceStyle(named);
    setCustomStyles(next);
    setEditor(null);
    setLiveAppearancePreview(null, resolvedTheme);
    onAppearanceStyleIdChange(named.id);
    applyAppearanceStyle(named.id, resolvedTheme);
  }

  function cancelEditor() {
    setEditor(null);
    endEditingPreview();
  }

  function removeEditorStyle() {
    if (!editor) return;
    if (editor.id === CLASSIC_STYLE_ID) {
      resetClassicTypography();
      setEditor(null);
      setLiveAppearancePreview(null, resolvedTheme);
      applyAppearanceStyle(appearanceStyleId, resolvedTheme);
      return;
    }
    if (editor.id === CYBER_STYLE_ID) {
      resetCyberAppearanceStyle();
      setCyberStyle(readCyberAppearanceStyle());
      setEditor(null);
      setLiveAppearancePreview(null, resolvedTheme);
      applyAppearanceStyle(appearanceStyleId, resolvedTheme);
      return;
    }
    const next = deleteCustomAppearanceStyle(editor.id);
    setCustomStyles(next);
    setEditor(null);
    setLiveAppearancePreview(null, resolvedTheme);
    if (appearanceStyleId === editor.id) {
      onAppearanceStyleIdChange(CLASSIC_STYLE_ID);
      applyAppearanceStyle(CLASSIC_STYLE_ID, resolvedTheme);
    } else {
      applyAppearanceStyle(appearanceStyleId, resolvedTheme);
    }
  }

  useEffect(() => {
    if (!editor) return;
    setLiveAppearancePreview(editor, resolvedTheme);
  }, [resolvedTheme, editor]);

  const appearanceStyleIdRef = useRef(appearanceStyleId);
  const resolvedThemeRef = useRef(resolvedTheme);
  appearanceStyleIdRef.current = appearanceStyleId;
  resolvedThemeRef.current = resolvedTheme;

  useEffect(() => {
    return () => {
      // Leaving Appearance (or closing Settings) drops unsaved live preview.
      setLiveAppearancePreview(null, resolvedThemeRef.current);
      applyAppearanceStyle(appearanceStyleIdRef.current, resolvedThemeRef.current);
    };
  }, []);

  const cyberPreviewSource = editor?.id === CYBER_STYLE_ID ? editor : cyberStyle;
  const cyberPreview =
    resolvedTheme === "dark" ? cyberPreviewSource.dark : cyberPreviewSource.light;

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Appearance"
        description="Built-in themes and themes you create and save."
      />

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
          Themes
        </p>
        <div className="flex flex-wrap gap-3" role="list">
          <StylePreviewCard
            label="Classic Light"
            subtitle={!systemPrefersDark ? "(System)" : undefined}
            selected={classicLightSelected}
            bodyFontId="libre-baskerville"
            previewStyle={{ backgroundColor: "#faf7f2", color: "#2a2622" }}
            onSelect={selectClassicLight}
            onEdit={openEditClassic}
          />
          <StylePreviewCard
            label="Classic Dark"
            subtitle={systemPrefersDark ? "(System)" : undefined}
            selected={classicDarkSelected}
            bodyFontId="libre-baskerville"
            previewStyle={{ backgroundColor: "#1d1d1d", color: "#e5e5e5" }}
            onSelect={selectClassicDark}
            onEdit={openEditClassic}
          />
          <StylePreviewCard
            label={
              editor?.id === CYBER_STYLE_ID ? editor.name : cyberStyle.name
            }
            selected={appearanceStyleId === CYBER_STYLE_ID}
            bodyFontId={resolveStyleBodyFont(
              editor?.id === CYBER_STYLE_ID ? editor : cyberStyle,
            )}
            previewStyle={{
              backgroundColor: cyberPreview.page,
              color: cyberPreview.ink,
            }}
            onSelect={() => selectStyle(CYBER_STYLE_ID)}
            onEdit={openEditCyber}
          />
          {customStyles.map((style) => {
            const previewSource = editor?.id === style.id ? editor : style;
            const palette = resolvedTheme === "dark" ? previewSource.dark : previewSource.light;
            return (
              <StylePreviewCard
                key={style.id}
                label={previewSource.name}
                selected={appearanceStyleId === style.id}
                bodyFontId={resolveStyleBodyFont(previewSource)}
                previewStyle={{
                  backgroundColor: palette.page,
                  color: palette.ink,
                }}
                onSelect={() => selectStyle(style.id)}
                onEdit={() => openEditStyle(style)}
              />
            );
          })}
          <button
            type="button"
            role="listitem"
            onClick={openNewStyle}
            className="group flex w-[5.25rem] flex-col items-center gap-1.5"
            aria-label="Add new theme"
          >
            <span className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-xl bg-mist text-[1.75rem] font-light text-ink/70 transition-colors group-hover:text-ink">
              +
            </span>
            <span className="text-center text-[11px] text-muted/80">Add New</span>
          </button>
        </div>
      </div>

      {editor ? (
        <StyleEditorForm
          style={editor}
          onChange={updateEditor}
          onSave={saveEditor}
          onCancel={cancelEditor}
          typographyOnly={editor.id === CLASSIC_STYLE_ID}
          onDelete={
            editor.id === CLASSIC_STYLE_ID
              ? removeEditorStyle
              : editor.id === CYBER_STYLE_ID
                ? hasCyberAppearanceOverrides()
                  ? removeEditorStyle
                  : undefined
                : customStyles.some((s) => s.id === editor.id)
                  ? removeEditorStyle
                  : undefined
          }
          deleteLabel={
            editor.id === CLASSIC_STYLE_ID || editor.id === CYBER_STYLE_ID ? "Reset" : "Delete"
          }
        />
      ) : null}
    </div>
  );
}

function StylePreviewCard({
  label,
  subtitle,
  selected,
  bodyFontId,
  previewClassName,
  previewStyle,
  onSelect,
  onEdit,
}: {
  label: string;
  subtitle?: string;
  selected: boolean;
  bodyFontId: AppearanceBodyFontId;
  previewClassName?: string;
  previewStyle?: CSSProperties;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  const bodyFont = resolveAppearanceBodyFont(bodyFontId);

  useEffect(() => {
    ensureAppearanceBodyFontLoaded(bodyFontId);
  }, [bodyFontId]);

  return (
    <div className="group flex w-[5.25rem] flex-col items-center gap-1.5" role="listitem">
      <div className="relative">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          title={subtitle ? `${label} ${subtitle}` : label}
          className={`flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-xl text-[1.35rem] font-medium tracking-tight transition-[box-shadow] ${
            selected
              ? "ring-2 ring-ink/55 dark:ring-white/55"
              : "ring-1 ring-line/30 hover:ring-line/55 dark:ring-white/10"
          } ${previewClassName ?? ""}`}
          style={{ ...previewStyle, fontFamily: bodyFont.stack }}
        >
          Abc
        </button>
        {onEdit ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-page/90 text-ink opacity-0 shadow-sm ring-1 ring-line/35 transition-opacity hover:bg-page group-hover:opacity-100 dark:bg-[#2a2a2a]/90 dark:ring-white/15"
          >
            <SquarePen size={12} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="flex w-full flex-col items-center gap-0.5">
        <span className="w-full text-center text-[11px] leading-tight text-ink/85">{label}</span>
        {subtitle ? (
          <span className="w-full text-center text-[10px] leading-tight text-muted/65">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

function BodyFontPicker({
  value,
  onChange,
}: {
  value: AppearanceBodyFontId;
  onChange: (next: AppearanceBodyFontId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState(() => listAppearanceBodyFonts());
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = resolveAppearanceBodyFont(value);

  useEffect(() => {
    const refresh = () => {
      ensureAllUserAppearanceFontsLoaded();
      setFonts(listAppearanceBodyFonts());
    };
    const onStorage = (event: StorageEvent) => {
      if (isUserAppearanceFontsStorageKey(event.key)) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(APPEARANCE_FONTS_CHANGED_EVENT, refresh);
    let unlisten: (() => void) | undefined;
    void listenFontsCatalogChanged(() => {
      refresh();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APPEARANCE_FONTS_CHANGED_EVENT, refresh);
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setFonts(listAppearanceBodyFonts());
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Body font"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border-0 bg-mist px-2.5 py-2 text-left text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-[var(--color-focus-ring)]/45"
        style={{ fontFamily: selected.stack }}
      >
        <span className="min-w-0 truncate">{selected.label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`shrink-0 text-ink/55 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md bg-mist shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line/30">
          <ul role="listbox" aria-label="Body font" className="max-h-56 overflow-y-auto py-1">
            {fonts.map((font) => {
              const isSelected = font.id === value;
              return (
                <li key={font.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(font.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] text-ink hover:bg-ink/[0.06] ${
                      isSelected ? "bg-ink/[0.08]" : ""
                    }`}
                    style={{ fontFamily: font.stack }}
                  >
                    <span className="flex w-4 shrink-0 justify-center">
                      {isSelected ? (
                        <Check size={14} strokeWidth={2.5} className="text-ink" aria-hidden />
                      ) : null}
                    </span>
                    <span className="min-w-0 truncate">{font.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line/20 p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void openAddFontsWindow();
              }}
              className="w-full rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-ink hover:bg-ink/[0.06]"
            >
              Add Fonts
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type StyleTypographyTool = "letterSpacing" | "lineHeight";

function formatTypographyValue(value: number, step: number): string {
  const decimals = String(step).includes(".") ? String(step).split(".")[1]!.length : 0;
  return value.toFixed(decimals);
}

function TypographyStepper({
  value,
  onChange,
  min,
  max,
  step,
  ariaLabel,
  tone = "panel",
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  tone?: "panel" | "popover";
}) {
  const display = formatTypographyValue(value, step);
  const isPopover = tone === "popover";
  return (
    <div
      className={
        isPopover
          ? "inline-flex h-9 items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10"
          : "inline-flex h-9 items-center rounded-xl bg-canvas/55 ring-1 ring-line/20 dark:bg-black/35 dark:ring-white/10"
      }
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(4))))}
        className={
          isPopover
            ? "flex h-9 w-8 items-center justify-center rounded-l-xl text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
            : "flex h-9 w-8 items-center justify-center rounded-l-xl text-ink/75 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-35 dark:hover:bg-white/[0.06]"
        }
      >
        <Minus size={14} strokeWidth={2} aria-hidden />
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={display}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (raw === "" || raw === "-" || raw === ".") return;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) return;
          onChange(parsed);
        }}
        onBlur={() => onChange(value)}
        className={
          isPopover
            ? "h-9 w-12 border-0 bg-transparent text-center text-[13px] tabular-nums text-white outline-none"
            : "h-9 w-12 border-0 bg-transparent text-center text-[13px] tabular-nums text-ink outline-none"
        }
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, Number((value + step).toFixed(4))))}
        className={
          isPopover
            ? "flex h-9 w-8 items-center justify-center rounded-r-xl text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
            : "flex h-9 w-8 items-center justify-center rounded-r-xl text-ink/75 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-35 dark:hover:bg-white/[0.06]"
        }
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

function TextColorToolIcon({ color }: { color: string }) {
  return (
    <span className="relative flex h-[1.35rem] w-[1.15rem] items-end justify-center" aria-hidden>
      <span className="pb-1 text-[15px] font-semibold leading-none" style={{ color }}>
        A
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-[3px] rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

function LetterSpacingToolIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden className="text-current">
      <path
        d="M6.2 13.5L9.1 4.5h1.8l2.9 9h-1.55l-.62-2.05H8.35L7.73 13.5H6.2Zm2.45-3.35h2.7L10.05 6.2h-.1L8.65 10.15Z"
        fill="currentColor"
      />
      <path
        d="M2.25 15.25H17.75M3.6 15.25l1.35 1.35M3.6 15.25l1.35-1.35M16.4 15.25l-1.35 1.35M16.4 15.25l-1.35-1.35"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LineHeightToolIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden className="text-current">
      <path
        d="M3.25 2.75v12.5M3.25 2.75L1.9 4.2M3.25 2.75L4.6 4.2M3.25 15.25L1.9 13.8M3.25 15.25L4.6 13.8"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 4.25h9M7.5 7.5h9M7.5 10.75h9M7.5 14h9"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StyleEditorForm({
  style,
  onChange,
  onSave,
  onCancel,
  onDelete,
  deleteLabel = "Delete",
  nameLocked = false,
  typographyOnly = false,
}: {
  style: CustomAppearanceStyle;
  onChange: (next: CustomAppearanceStyle) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  nameLocked?: boolean;
  /** Classic: only font size / letter spacing / line height. */
  typographyOnly?: boolean;
}) {
  const seeds = seedsFromStyle(style);
  const typography = resolveStyleTypography(style);
  const [activeSeed, setActiveSeed] = useState<keyof StyleBasics | null>(null);
  const [activeTypographyTool, setActiveTypographyTool] = useState<StyleTypographyTool | null>(
    null,
  );
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [toolPos, setToolPos] = useState<{ top: number; left: number } | null>(null);
  const swatchRefs = useRef<Partial<Record<keyof StyleBasics, HTMLButtonElement | null>>>({});
  const typographyToolRefs = useRef<Partial<Record<StyleTypographyTool, HTMLButtonElement | null>>>(
    {},
  );
  const pickerRootRef = useRef<HTMLDivElement>(null);
  const toolPopoverRef = useRef<HTMLDivElement>(null);

  function setSeed(key: keyof StyleBasics, value: string) {
    const currentSeeds = seedsFromStyle(style);
    onChange(styleWithSeeds(style, { ...currentSeeds, [key]: value }));
  }

  function setTypography<K extends keyof typeof typography>(key: K, value: number) {
    const next = resolveStyleTypography({ ...typography, [key]: value });
    onChange({ ...style, ...next });
  }

  useLayoutEffect(() => {
    if (!activeSeed || typographyOnly) {
      setPickerPos(null);
      return;
    }
    function place() {
      const el = activeSeed ? swatchRefs.current[activeSeed] : null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pickerWidth = 280;
      const pickerHeight = 280;
      const gap = 8;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - pickerWidth - 8,
      );
      let top = rect.bottom + gap;
      if (top + pickerHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - pickerHeight - gap);
      }
      setPickerPos({ top, left });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [activeSeed, typographyOnly]);

  useLayoutEffect(() => {
    if (!activeTypographyTool) {
      setToolPos(null);
      return;
    }
    function place() {
      const el = activeTypographyTool
        ? typographyToolRefs.current[activeTypographyTool]
        : null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const popoverWidth = 148;
      const popoverHeight = 52;
      const gap = 8;
      const left = Math.min(
        Math.max(8, rect.left + rect.width / 2 - popoverWidth / 2),
        window.innerWidth - popoverWidth - 8,
      );
      let top = rect.bottom + gap;
      if (top + popoverHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - popoverHeight - gap);
      }
      setToolPos({ top, left });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [activeTypographyTool]);

  useEffect(() => {
    if (!activeSeed && !activeTypographyTool) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (activeSeed) {
        const swatch = swatchRefs.current[activeSeed];
        if (swatch?.contains(target) || pickerRootRef.current?.contains(target)) return;
        setActiveSeed(null);
      }
      if (activeTypographyTool) {
        const toolBtn = typographyToolRefs.current[activeTypographyTool];
        if (toolBtn?.contains(target) || toolPopoverRef.current?.contains(target)) return;
        setActiveTypographyTool(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setActiveSeed(null);
      setActiveTypographyTool(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [activeSeed, activeTypographyTool]);

  const surfaceFields: Array<{
    key: "canvas" | "muted" | "accent";
    label: string;
  }> = [
    { key: "canvas", label: "Canvas" },
    { key: "muted", label: "Boxes" },
    { key: "accent", label: "Icons" },
  ];

  const inkOpen = activeSeed === "ink";
  const inkColor = normalizeHexColor(seeds.ink);

  return (
    <div className="space-y-4 rounded-lg bg-stage/80 px-3.5 py-3 ring-1 ring-line/15 dark:bg-ink/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink">Edit theme</p>
        <div className="flex items-center gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md px-2 py-1 text-[12px] text-muted/80 hover:text-ink"
            >
              {deleteLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2 py-1 text-[12px] text-muted/80 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md bg-ink px-2.5 py-1 text-[12px] font-medium text-page"
          >
            Save
          </button>
        </div>
      </div>

      {!typographyOnly ? (
        <>
          <label className="block">
            <span className="text-[11px] text-muted/75">Name</span>
            <input
              type="text"
              value={style.name}
              disabled={nameLocked}
              onChange={(e) => onChange({ ...style, name: e.target.value })}
              className="mt-1 w-full rounded-md border-0 bg-mist px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-[var(--color-focus-ring)]/45 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <div className="block">
            <span className="text-[11px] text-muted/75">Body font</span>
            <BodyFontPicker
              value={resolveStyleBodyFont(style)}
              onChange={(bodyFont) =>
                onChange({
                  ...style,
                  bodyFont,
                  monoContent: undefined,
                })
              }
            />
          </div>
        </>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <TypographyStepper
            value={typography.fontSizePx}
            min={STYLE_TYPOGRAPHY_LIMITS.fontSizePx.min}
            max={STYLE_TYPOGRAPHY_LIMITS.fontSizePx.max}
            step={STYLE_TYPOGRAPHY_LIMITS.fontSizePx.step}
            ariaLabel="Font size"
            onChange={(fontSizePx) => setTypography("fontSizePx", fontSizePx)}
          />

          {!typographyOnly ? (
            <button
              ref={(el) => {
                swatchRefs.current.ink = el;
              }}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                setActiveTypographyTool(null);
                setActiveSeed(inkOpen ? null : "ink");
              }}
              aria-expanded={inkOpen}
              aria-haspopup="dialog"
              aria-label="Text color"
              title={`Text color: ${inkColor}`}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                inkOpen
                  ? "bg-ink/[0.08] text-ink dark:bg-white/[0.08]"
                  : "text-ink/80 hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.06]"
              }`}
            >
              <TextColorToolIcon color={inkColor} />
            </button>
          ) : null}

          <button
            ref={(el) => {
              typographyToolRefs.current.letterSpacing = el;
            }}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setActiveSeed(null);
              setActiveTypographyTool(
                activeTypographyTool === "letterSpacing" ? null : "letterSpacing",
              );
            }}
            aria-expanded={activeTypographyTool === "letterSpacing"}
            aria-haspopup="dialog"
            aria-label="Letter spacing"
            title={`Letter spacing: ${formatTypographyValue(
              typography.letterSpacingPx,
              STYLE_TYPOGRAPHY_LIMITS.letterSpacingPx.step,
            )}px`}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              activeTypographyTool === "letterSpacing"
                ? "bg-ink/[0.08] text-ink dark:bg-white/[0.08]"
                : "text-ink/80 hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.06]"
            }`}
          >
            <LetterSpacingToolIcon />
          </button>

          <button
            ref={(el) => {
              typographyToolRefs.current.lineHeight = el;
            }}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setActiveSeed(null);
              setActiveTypographyTool(
                activeTypographyTool === "lineHeight" ? null : "lineHeight",
              );
            }}
            aria-expanded={activeTypographyTool === "lineHeight"}
            aria-haspopup="dialog"
            aria-label="Line height"
            title={`Line height: ${formatTypographyValue(
              typography.lineHeight,
              STYLE_TYPOGRAPHY_LIMITS.lineHeight.step,
            )}`}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              activeTypographyTool === "lineHeight"
                ? "bg-ink/[0.08] text-ink dark:bg-white/[0.08]"
                : "text-ink/80 hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.06]"
            }`}
          >
            <LineHeightToolIcon />
          </button>
        </div>

        {!typographyOnly ? (
          <div className="flex flex-nowrap items-center gap-x-3.5">
            {surfaceFields.map((field) => {
              const color = normalizeHexColor(seeds[field.key]);
              const open = activeSeed === field.key;
              return (
                <div key={field.key} className="relative flex min-w-0 items-center gap-2">
                  <button
                    ref={(el) => {
                      swatchRefs.current[field.key] = el;
                    }}
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      setActiveTypographyTool(null);
                      setActiveSeed(open ? null : field.key);
                    }}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    aria-label={`${field.label} color`}
                    title={`${field.label}: ${color}`}
                    className={`relative h-6 w-8 shrink-0 overflow-hidden rounded-md ring-2 transition-[box-shadow] ${
                      open
                        ? "ring-[var(--color-focus-ring,#5f6a7a)]"
                        : "ring-[var(--color-focus-ring,#5f6a7a)]/55 hover:ring-[var(--color-focus-ring,#5f6a7a)]"
                    }`}
                  >
                    <span className="absolute inset-0" style={{ backgroundColor: color }} />
                  </button>
                  <span className="text-[12px] text-ink/90">{field.label}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {!typographyOnly && activeSeed && pickerPos
        ? createPortal(
            <div
              ref={pickerRootRef}
              role="dialog"
              aria-label={`${
                activeSeed === "ink"
                  ? "Text"
                  : surfaceFields.find((f) => f.key === activeSeed)?.label ?? "Color"
              } color picker`}
              className="fixed z-[400]"
              style={{ top: pickerPos.top, left: pickerPos.left }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <CanvaColorPicker
                key={activeSeed}
                value={normalizeHexColor(seeds[activeSeed])}
                onChange={(hex) => setSeed(activeSeed, hex)}
              />
            </div>,
            document.body,
          )
        : null}

      {activeTypographyTool && toolPos
        ? createPortal(
            <div
              ref={toolPopoverRef}
              role="dialog"
              aria-label={
                activeTypographyTool === "letterSpacing" ? "Letter spacing" : "Line height"
              }
              className="fixed z-[400] rounded-xl bg-[#1a1a1a] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
              style={{ top: toolPos.top, left: toolPos.left }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {activeTypographyTool === "letterSpacing" ? (
                <TypographyStepper
                  tone="popover"
                  value={typography.letterSpacingPx}
                  min={STYLE_TYPOGRAPHY_LIMITS.letterSpacingPx.min}
                  max={STYLE_TYPOGRAPHY_LIMITS.letterSpacingPx.max}
                  step={STYLE_TYPOGRAPHY_LIMITS.letterSpacingPx.step}
                  ariaLabel="Letter spacing"
                  onChange={(letterSpacingPx) => setTypography("letterSpacingPx", letterSpacingPx)}
                />
              ) : (
                <TypographyStepper
                  tone="popover"
                  value={typography.lineHeight}
                  min={STYLE_TYPOGRAPHY_LIMITS.lineHeight.min}
                  max={STYLE_TYPOGRAPHY_LIMITS.lineHeight.max}
                  step={STYLE_TYPOGRAPHY_LIMITS.lineHeight.step}
                  ariaLabel="Line height"
                  onChange={(lineHeight) => setTypography("lineHeight", lineHeight)}
                />
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}


function normalizeHexColor(value: string): string {
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{8}$/.test(raw)) return `#${raw.slice(1, 7)}`;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1]!;
    const g = raw[2]!;
    const b = raw[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#888888";
}

function EncouragementPanel({
  prefs,
  onChange,
  onTest,
}: {
  prefs: EncouragementPrefs;
  onChange: (partial: Partial<EncouragementPrefs>) => void;
  onTest?: () => void;
}) {
  const [phrasesExpanded, setPhrasesExpanded] = useState(false);

  function updateRange(partial: { minMinutes?: number; maxMinutes?: number }) {
    onChange(partial);
  }

  function updatePhrase(id: string, partial: Partial<Pick<EncouragementPhrase, "text" | "author">>) {
    onChange({
      phrases: prefs.phrases.map((phrase) =>
        phrase.id === id ? { ...phrase, ...partial } : phrase,
      ),
    });
  }

  function addRow() {
    onChange({
      phrases: [
        ...prefs.phrases,
        {
          id: `enc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: "",
          author: "",
        },
      ],
    });
  }

  function removePhrase(id: string) {
    onChange({ phrases: prefs.phrases.filter((p) => p.id !== id) });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <SettingsSectionHeader
          title="Encouragement"
          description="Occasional phrases in the top-right while you write."
        />
        <button
          type="button"
          onClick={onTest}
          disabled={!onTest || prefs.phrases.every((p) => !p.text.trim())}
          className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-page transition-opacity disabled:opacity-35"
          title={
            prefs.phrases.every((p) => !p.text.trim())
              ? "Add a phrase first"
              : "Show a sample notification now"
          }
        >
          Test
        </button>
      </div>

      <SettingsGroup label="Notifications">
        <ToggleRow
          id="encouragement-enabled"
          label="Enable"
          description="Show a random phrase on a timer."
          checked={prefs.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
      </SettingsGroup>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
          Interval (minutes)
        </p>
        <div className={SETTINGS_BOX_PAD}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[6.5rem] flex-col gap-1">
              <span className="text-[11px] text-muted/75">From</span>
              <input
                type="number"
                min={1}
                max={240}
                value={prefs.minMinutes}
                onChange={(e) => updateRange({ minMinutes: Number(e.target.value) })}
                className={`w-full ${SETTINGS_FIELD_INPUT}`}
              />
            </label>
            <span className="pb-2 text-[12px] text-muted/55">to</span>
            <label className="flex min-w-[6.5rem] flex-col gap-1">
              <span className="text-[11px] text-muted/75">Until</span>
              <input
                type="number"
                min={1}
                max={240}
                value={prefs.maxMinutes}
                onChange={(e) => updateRange({ maxMinutes: Number(e.target.value) })}
                className={`w-full ${SETTINGS_FIELD_INPUT}`}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted/70">
            Picks a random time in this range (e.g. 15–45).
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
            Phrases
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={addRow}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-muted/80 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              Add row
            </button>
            <button
              type="button"
              onClick={() => setPhrasesExpanded(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted/60 transition-colors hover:bg-ink/[0.06] hover:text-ink"
              aria-label="Expand phrases table"
              title="Expand phrases table"
            >
              <SquareArrowOutUpRight size={14} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </div>

        <PhrasesCsvTable
          phrases={prefs.phrases}
          onUpdate={updatePhrase}
          onRemove={removePhrase}
          maxHeightClass="max-h-[14rem]"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted/70">
          One phrase per row — quote and attribution.
        </p>
      </div>

      <CenteredOverlayModal
        open={phrasesExpanded}
        onClose={() => setPhrasesExpanded(false)}
        title="Phrases"
        titleId="phrases-expand-dialog-title"
        backdropLabel="Close phrases table"
        closeLabel="Close phrases table"
        panelSizeClassName={PHRASES_EXPAND_PANEL_SIZE}
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5"
        zIndexClass="z-[220]"
        escapeCapture
        subtitle="Quote and Said by — one phrase per row."
      >
        <div className="mb-3 flex shrink-0 items-center justify-end">
          <button
            type="button"
            onClick={addRow}
            className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted/80 transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            Add row
          </button>
        </div>
        <PhrasesCsvTable
          phrases={prefs.phrases}
          onUpdate={updatePhrase}
          onRemove={removePhrase}
          maxHeightClass="min-h-0 flex-1"
          fillHeight
        />
      </CenteredOverlayModal>
    </div>
  );
}

function EditorPanel({
  spellcheckEnabled,
  onSpellcheckChange,
  focusVisibilityPrefs,
  onFocusVisibilityPrefChange,
  documentHeaderPrefs,
  onDocumentHeaderPrefChange,
}: {
  spellcheckEnabled: boolean;
  onSpellcheckChange: (v: boolean) => void;
  focusVisibilityPrefs: FocusVisibilityPrefs;
  onFocusVisibilityPrefChange: (partial: Partial<FocusVisibilityPrefs>) => void;
  documentHeaderPrefs: DocumentHeaderPrefs;
  onDocumentHeaderPrefChange: (partial: Partial<DocumentHeaderPrefs>) => void;
}) {
  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Editor"
        description="Writing surface and chrome while you type."
      />

      <SettingsGroup label="Document" labelStyle="italic">
        <ToggleRow
          id="show-document-title"
          label="Title"
          description="Headline field above the body."
          checked={documentHeaderPrefs.showTitle}
          onChange={(v) => onDocumentHeaderPrefChange({ showTitle: v })}
        />
        <ToggleRow
          id="show-document-subtitle"
          label="Subtitle"
          description="Optional dek under the title."
          checked={documentHeaderPrefs.showSubtitle}
          onChange={(v) => onDocumentHeaderPrefChange({ showSubtitle: v })}
        />
        <ToggleRow
          id="spellcheck"
          label="Spellcheck"
          description="Underline misspellings; apply fixes from the menu."
          checked={spellcheckEnabled}
          onChange={onSpellcheckChange}
        />
      </SettingsGroup>

      <SettingsGroup
        label="While Typing"
        labelStyle="italic"
        hint="Applies when both sidebars are closed."
      >
        <ToggleRow
          id="keep-top-bar-visible-while-typing"
          label="Page Tab Bar"
          description="Tabs and sidebar toggles stay visible."
          checked={focusVisibilityPrefs.keepTopBarVisibleWhileTyping}
          onChange={(v) => onFocusVisibilityPrefChange({ keepTopBarVisibleWhileTyping: v })}
        />
        <ToggleRow
          id="keep-document-title-visible-while-typing"
          label="Document Name"
          description="Document title and unsaved indicator."
          checked={focusVisibilityPrefs.keepDocumentTitleVisibleWhileTyping}
          onChange={(v) =>
            onFocusVisibilityPrefChange({ keepDocumentTitleVisibleWhileTyping: v })
          }
        />
        <ToggleRow
          id="keep-bottom-tools-visible-while-typing"
          label="Control Panel"
          description="Sidebar, timer, and copy controls."
          checked={focusVisibilityPrefs.keepBottomToolsVisibleWhileTyping}
          onChange={(v) => onFocusVisibilityPrefChange({ keepBottomToolsVisibleWhileTyping: v })}
        />
      </SettingsGroup>
    </div>
  );
}

function ParametersFields({
  prefs,
  onChange,
}: {
  prefs: ParametersPrefs;
  onChange: (partial: Partial<ParametersPrefs>) => void;
}) {
  const [showReadingGradeFormula, setShowReadingGradeFormula] = useState(false);
  const [showComplexityFormula, setShowComplexityFormula] = useState(false);

  return (
    <ul className={SETTINGS_BOX}>
      <li className="space-y-2 px-3.5 py-3">
        <div>
          <p className="text-[13px] font-medium text-ink">Reading grade</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
            Flesch–Kincaid U.S. grade level for the document.{" "}
            <button
              type="button"
              onClick={() => setShowReadingGradeFormula((v) => !v)}
              className="font-medium text-ink/80 underline-offset-2 hover:underline"
            >
              {showReadingGradeFormula ? "Less" : "More"}
            </button>
          </p>
        </div>
        {showReadingGradeFormula ? (
          <div className="font-mono text-[11px] leading-relaxed text-muted/80">
            <p>0.39 × (words ÷ sentences) + 11.8 × (syllables ÷ words) − 15.59</p>
          </div>
        ) : null}
      </li>

      <li>
        <label className="flex items-start justify-between gap-4 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink">Words per minute</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
              Reading-time estimate. Suggested {SUGGESTED_READING_WPM_MIN}–
              {SUGGESTED_READING_WPM_MAX}.
            </p>
          </div>
          <input
            type="number"
            min={READING_WPM_MIN}
            max={READING_WPM_MAX}
            step={10}
            value={prefs.readingWordsPerMinute}
            onChange={(e) => onChange({ readingWordsPerMinute: Number(e.target.value) })}
            className={SETTINGS_INLINE_INPUT}
          />
        </label>
      </li>

      <li className="space-y-2 px-3.5 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink">Sentence complexity</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
              Highlight sentences at or above this F–K density. Suggested{" "}
              {SUGGESTED_FK_COMPLEXITY_THRESHOLD_MIN}–{SUGGESTED_FK_COMPLEXITY_THRESHOLD_MAX}.{" "}
              <button
                type="button"
                onClick={() => setShowComplexityFormula((v) => !v)}
                className="font-medium text-ink/80 underline-offset-2 hover:underline"
              >
                {showComplexityFormula ? "Less" : "More"}
              </button>
            </p>
          </div>
          <input
            type="number"
            min={FK_COMPLEXITY_THRESHOLD_MIN}
            max={FK_COMPLEXITY_THRESHOLD_MAX}
            step={1}
            value={prefs.fkComplexityThreshold}
            onChange={(e) => onChange({ fkComplexityThreshold: Number(e.target.value) })}
            aria-label="Sentence complexity threshold"
            className={SETTINGS_INLINE_INPUT}
          />
        </div>
        {showComplexityFormula ? (
          <div className="font-mono text-[11px] leading-relaxed text-muted/80">
            <p>
              0.39 × words + 11.8 × (syllables ÷ words) − 15.59 ≥ {prefs.fkComplexityThreshold}
            </p>
          </div>
        ) : null}
      </li>
    </ul>
  );
}

function HotkeysPanel() {
  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Shortcuts"
        description="Keys adapt to your keyboard (⌘ / Ctrl)."
      />

      {HOTKEY_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
            {group.title}
          </p>
          <ul className={SETTINGS_BOX}>
            {group.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{item.action}</p>
                  {item.note ? (
                    <p className="mt-0.5 text-[11px] leading-snug text-muted/75">{item.note}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 pt-0.5">
                  {formatHotkeyKeys(item.keys).map((label, index) => (
                    <kbd
                      key={`${item.id}-${index}-${label}`}
                      className="inline-flex items-center justify-center font-mono text-[12px] font-medium leading-none text-muted/85"
                    >
                      {label}
                    </kbd>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-4 px-3.5 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-snug text-muted/85">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          onChange(!checked);
        }}
        className={`harvy-settings-switch relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-[background-color,box-shadow,border-color,opacity] duration-200 ${
          checked ? "harvy-settings-switch--on" : "harvy-settings-switch--off"
        } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
      >
        <span
          aria-hidden
          className={`harvy-settings-switch-knob pointer-events-none absolute left-0.5 top-0.5 block h-5 w-5 rounded-full transition-[transform,background-color,box-shadow] duration-200 ease-out ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </li>
  );
}

function SettingsAboutSection() {
  return (
    <div className="space-y-5">
      <SettingsSectionHeader title="About" />
      <div className={`space-y-2 ${SETTINGS_BOX_PAD}`}>
        <p className="text-[14px] font-semibold tracking-tight text-ink">
          {APP_NAME} <span className="font-normal text-muted/80">v0.1.0</span>
        </p>
        <p className="max-w-md text-[12px] leading-relaxed text-muted/90">
          A calm writing workspace for drafting and refining text next to your files.
        </p>
      </div>
    </div>
  );
}
