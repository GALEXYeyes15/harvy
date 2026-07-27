import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, SquareArrowOutUpRight, SquarePen } from "lucide-react";
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
  readCyberAppearanceStyle,
  readCustomAppearanceStyles,
  resetCyberAppearanceStyle,
  resolveStyleBodyFont,
  seedsFromStyle,
  setLiveAppearancePreview,
  styleWithSeeds,
  upsertCustomAppearanceStyle,
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
const SETTINGS_DIVIDE_Y = "divide-y divide-line/[0.1] dark:divide-[#6f6f6f]";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  appearanceStyleId: AppearanceStyleId;
  onAppearanceStyleIdChange: (id: AppearanceStyleId) => void;
  resolvedTheme: ResolvedTheme;
  systemPrefersDark: boolean;
  readabilityPanelOpen: boolean;
  onReadabilityPanelChange: (open: boolean) => void;
  spellcheckEnabled: boolean;
  grammarChecksEnabled: boolean;
  onSpellcheckChange: (enabled: boolean) => void;
  onGrammarChecksChange: (enabled: boolean) => void;
  focusVisibilityPrefs: FocusVisibilityPrefs;
  onFocusVisibilityPrefChange: (partial: Partial<FocusVisibilityPrefs>) => void;
  documentHeaderPrefs: DocumentHeaderPrefs;
  onDocumentHeaderPrefChange: (partial: Partial<DocumentHeaderPrefs>) => void;
  enableCollect: boolean;
  onEnableCollectChange: (enabled: boolean) => void;
  showOutliersView: boolean;
  showCollectView: boolean;
  onShowOutliersViewChange: (enabled: boolean) => void;
  onShowCollectViewChange: (enabled: boolean) => void;
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
  readabilityPanelOpen,
  onReadabilityPanelChange,
  spellcheckEnabled,
  grammarChecksEnabled,
  onSpellcheckChange,
  onGrammarChecksChange,
  focusVisibilityPrefs,
  onFocusVisibilityPrefChange,
  documentHeaderPrefs,
  onDocumentHeaderPrefChange,
  enableCollect,
  onEnableCollectChange,
  showOutliersView,
  showCollectView,
  onShowOutliersViewChange,
  onShowCollectViewChange,
  encouragementPrefs,
  onEncouragementPrefsChange,
  onTestEncouragement,
  parametersPrefs,
  onParametersPrefsChange,
  workspaceRootPath,
  onChooseWorkspaceFolder,
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [focusMode, setFocusMode] = useState(false);
  const [typewriterScroll, setTypewriterScroll] = useState(false);

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
            {activeSection === "general" ? (
              <GeneralPanel
                enableCollect={enableCollect}
                onEnableCollectChange={onEnableCollectChange}
                showOutliersView={showOutliersView}
                showCollectView={showCollectView}
                onShowOutliersViewChange={onShowOutliersViewChange}
                onShowCollectViewChange={onShowCollectViewChange}
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
            {activeSection === "editor" ? (
              <EditorPanel
                showReadabilityPanel={readabilityPanelOpen}
                onReadabilityChange={onReadabilityPanelChange}
                spellcheckEnabled={spellcheckEnabled}
                grammarChecksEnabled={grammarChecksEnabled}
                onSpellcheckChange={onSpellcheckChange}
                onGrammarChecksChange={onGrammarChecksChange}
                focusVisibilityPrefs={focusVisibilityPrefs}
                onFocusVisibilityPrefChange={onFocusVisibilityPrefChange}
                documentHeaderPrefs={documentHeaderPrefs}
                onDocumentHeaderPrefChange={onDocumentHeaderPrefChange}
                focusMode={focusMode}
                onFocusModeChange={setFocusMode}
                typewriterScroll={typewriterScroll}
                onTypewriterChange={setTypewriterScroll}
              />
            ) : null}
            {activeSection === "parameters" ? (
              <ParametersPanel prefs={parametersPrefs} onChange={onParametersPrefsChange} />
            ) : null}
            {activeSection === "shortcuts" ? <HotkeysPanel /> : null}
            {activeSection === "encouragement" ? (
              <EncouragementPanel
                prefs={encouragementPrefs}
                onChange={onEncouragementPrefsChange}
                onTest={onTestEncouragement}
              />
            ) : null}
            {activeSection === "files" ? (
              <FilesPanel
                workspaceRootPath={workspaceRootPath}
                onChooseWorkspaceFolder={onChooseWorkspaceFolder}
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
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
        {label}
      </p>
      <ul className={`${SETTINGS_DIVIDE_Y} overflow-hidden rounded-lg bg-mist/80 dark:bg-ink/[0.035]`}>
        {children}
      </ul>
      {hint ? <p className="mt-2 text-[11px] leading-snug text-muted/70">{hint}</p> : null}
    </div>
  );
}

function GeneralPanel({
  enableCollect,
  onEnableCollectChange,
  showOutliersView,
  showCollectView,
  onShowOutliersViewChange,
  onShowCollectViewChange,
}: {
  enableCollect: boolean;
  onEnableCollectChange: (enabled: boolean) => void;
  showOutliersView: boolean;
  showCollectView: boolean;
  onShowOutliersViewChange: (enabled: boolean) => void;
  onShowCollectViewChange: (enabled: boolean) => void;
}) {
  const [fetchIntervalMinutes, setFetchIntervalMinutes] = useState(
    () => readOutliersSettings().fetchIntervalMinutes,
  );

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="General"
        description="Workspace features and Collect."
      />
      <SettingsGroup label="Collect">
        <ToggleRow
          id="enable-collect"
          label="Show Collect"
          description="Add Collect to the left workspace rail."
          checked={enableCollect}
          onChange={onEnableCollectChange}
        />
      </SettingsGroup>
      {enableCollect ? (
        <SettingsGroup
          label="Collect views"
          hint="Keep at least one view on."
        >
          <ToggleRow
            id="show-outliers-view"
            label="Outliers"
            description="Creator posts and Notes scored against your average."
            checked={showOutliersView}
            onChange={onShowOutliersViewChange}
            disabled={showOutliersView && !showCollectView}
          />
          <ToggleRow
            id="show-collect-view"
            label="Saved items"
            description="Your Collect table of saved research."
            checked={showCollectView}
            onChange={onShowCollectViewChange}
            disabled={showCollectView && !showOutliersView}
          />
        </SettingsGroup>
      ) : null}
      {enableCollect && showOutliersView ? (
        <label className="flex items-start justify-between gap-4 rounded-lg bg-mist/80 px-3.5 py-3 dark:bg-ink/[0.035]">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink">Outliers fetch interval</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
              Minutes between refreshes after you click Fetch posts. Default{" "}
              {DEFAULT_OUTLIERS_FETCH_INTERVAL_MINUTES}.
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
            className="w-[4.5rem] shrink-0 rounded-md border-0 bg-canvas/45 px-2 py-1.5 text-right text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-ink/20 dark:bg-canvas/35"
          />
        </label>
      ) : null}
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

  function saveEditor() {
    if (!editor) return;
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
          />
          <StylePreviewCard
            label="Classic Dark"
            subtitle={systemPrefersDark ? "(System)" : undefined}
            selected={classicDarkSelected}
            bodyFontId="libre-baskerville"
            previewStyle={{ backgroundColor: "#1d1d1d", color: "#e5e5e5" }}
            onSelect={selectClassicDark}
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
            <span className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-xl bg-mist/80 text-[1.75rem] font-light text-ink/70 ring-1 ring-line/35 transition-colors group-hover:bg-mist group-hover:text-ink dark:bg-ink/[0.04] dark:ring-white/10">
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
          onDelete={
            editor.id === CYBER_STYLE_ID
              ? hasCyberAppearanceOverrides()
                ? removeEditorStyle
                : undefined
              : customStyles.some((s) => s.id === editor.id)
                ? removeEditorStyle
                : undefined
          }
          deleteLabel={editor.id === CYBER_STYLE_ID ? "Reset" : "Delete"}
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
        className="flex w-full items-center justify-between gap-2 rounded-md border-0 bg-canvas/45 px-2.5 py-2 text-left text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-ink/20 dark:bg-canvas/35"
        style={{ fontFamily: selected.stack }}
      >
        <span className="min-w-0 truncate">{selected.label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`shrink-0 text-muted/70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md bg-page shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line/40 dark:bg-[#1e1e1e] dark:ring-white/10">
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
                    className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] text-ink hover:bg-mist/80 dark:hover:bg-white/[0.06] ${
                      isSelected ? "bg-mist/55 dark:bg-white/[0.04]" : ""
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
              className="w-full rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-ink hover:bg-mist/80 dark:hover:bg-white/[0.06]"
            >
              Add Fonts
            </button>
          </div>
        </div>
      ) : null}
    </div>
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
}: {
  style: CustomAppearanceStyle;
  onChange: (next: CustomAppearanceStyle) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  nameLocked?: boolean;
}) {
  const seeds = seedsFromStyle(style);
  const [activeSeed, setActiveSeed] = useState<keyof StyleBasics | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const swatchRefs = useRef<Partial<Record<keyof StyleBasics, HTMLButtonElement | null>>>({});
  const pickerRootRef = useRef<HTMLDivElement>(null);

  function setSeed(key: keyof StyleBasics, value: string) {
    onChange(styleWithSeeds(style, { ...seeds, [key]: value }));
  }

  useLayoutEffect(() => {
    if (!activeSeed) {
      setPickerPos(null);
      return;
    }
    const swatch = swatchRefs.current[activeSeed];
    if (!swatch) return;

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
  }, [activeSeed]);

  useEffect(() => {
    if (!activeSeed) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (pickerRootRef.current?.contains(target)) return;
      const swatch = swatchRefs.current[activeSeed];
      if (swatch?.contains(target)) return;
      setActiveSeed(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setActiveSeed(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [activeSeed]);

  const fields: Array<{
    key: keyof StyleBasics;
    label: string;
  }> = [
    { key: "canvas", label: "Canvas" },
    { key: "ink", label: "Ink" },
    { key: "muted", label: "Muted" },
    { key: "accent", label: "Accent" },
  ];

  return (
    <div className="space-y-4 rounded-lg bg-mist/80 px-3.5 py-3 dark:bg-ink/[0.035]">
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

      <label className="block">
        <span className="text-[11px] text-muted/75">Name</span>
        <input
          type="text"
          value={style.name}
          disabled={nameLocked}
          onChange={(e) => onChange({ ...style, name: e.target.value })}
          className="mt-1 w-full rounded-md border-0 bg-canvas/45 px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-ink/20 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-canvas/35"
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

      <div className="space-y-2 rounded-md bg-page/60 px-3 py-2.5 dark:bg-page/35">
        <p className="text-[11px] leading-snug text-muted/75">
          Muted colors the notes, search, and tab bar; accent colors chrome icons. Click a
          swatch to pick a color.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {fields.map((field) => {
          const color = normalizeHexColor(seeds[field.key]);
          const open = activeSeed === field.key;
          return (
            <div key={field.key} className="relative flex items-center gap-2.5">
              <button
                ref={(el) => {
                  swatchRefs.current[field.key] = el;
                }}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setActiveSeed(open ? null : field.key)}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={`${field.label} color`}
                title={`${field.label}: ${color}`}
                className={`relative h-8 w-11 shrink-0 overflow-hidden rounded-lg ring-2 transition-[box-shadow] ${
                  open
                    ? "ring-[var(--color-focus-ring,#5f6a7a)]"
                    : "ring-[var(--color-focus-ring,#5f6a7a)]/55 hover:ring-[var(--color-focus-ring,#5f6a7a)]"
                }`}
              >
                <span className="absolute inset-0" style={{ backgroundColor: color }} />
              </button>
              <span className="text-[13px] text-ink/90">{field.label}</span>
            </div>
          );
        })}
      </div>

      {activeSeed && pickerPos
        ? createPortal(
            <div
              ref={pickerRootRef}
              role="dialog"
              aria-label={`${fields.find((f) => f.key === activeSeed)?.label ?? "Color"} color picker`}
              className="fixed z-[400]"
              style={{ top: pickerPos.top, left: pickerPos.left }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <CanvaColorPicker
                value={normalizeHexColor(seeds[activeSeed])}
                onChange={(hex) => setSeed(activeSeed, hex)}
              />
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
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[6.5rem] flex-col gap-1">
            <span className="text-[11px] text-muted/75">From</span>
            <input
              type="number"
              min={1}
              max={240}
              value={prefs.minMinutes}
              onChange={(e) => updateRange({ minMinutes: Number(e.target.value) })}
              className="w-full rounded-md border-0 bg-canvas/45 px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-ink/20 dark:bg-canvas/35"
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
              className="w-full rounded-md border-0 bg-canvas/45 px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-ink/20 dark:bg-canvas/35"
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted/70">
          Picks a random time in this range (e.g. 15–45).
        </p>
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
  showReadabilityPanel,
  onReadabilityChange,
  spellcheckEnabled,
  grammarChecksEnabled,
  onSpellcheckChange,
  onGrammarChecksChange,
  focusVisibilityPrefs,
  onFocusVisibilityPrefChange,
  documentHeaderPrefs,
  onDocumentHeaderPrefChange,
  focusMode,
  onFocusModeChange,
  typewriterScroll,
  onTypewriterChange,
}: {
  showReadabilityPanel: boolean;
  onReadabilityChange: (v: boolean) => void;
  spellcheckEnabled: boolean;
  grammarChecksEnabled: boolean;
  onSpellcheckChange: (v: boolean) => void;
  onGrammarChecksChange: (v: boolean) => void;
  focusVisibilityPrefs: FocusVisibilityPrefs;
  onFocusVisibilityPrefChange: (partial: Partial<FocusVisibilityPrefs>) => void;
  documentHeaderPrefs: DocumentHeaderPrefs;
  onDocumentHeaderPrefChange: (partial: Partial<DocumentHeaderPrefs>) => void;
  focusMode: boolean;
  onFocusModeChange: (v: boolean) => void;
  typewriterScroll: boolean;
  onTypewriterChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Editor"
        description="Writing surface, assistance, and chrome while you type."
      />

      <SettingsGroup label="Document">
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
      </SettingsGroup>

      <SettingsGroup label="Assistance">
        <ToggleRow
          id="spellcheck"
          label="Spellcheck"
          description="Underline misspellings; apply fixes from the menu."
          checked={spellcheckEnabled}
          onChange={onSpellcheckChange}
        />
        <ToggleRow
          id="grammar-checks"
          label="Writing hints"
          description="Light underlines for spacing, repetition, and style."
          checked={grammarChecksEnabled}
          onChange={onGrammarChecksChange}
        />
      </SettingsGroup>

      <SettingsGroup label="Sidebar">
        <ToggleRow
          id="readability-panel"
          label="Notes & stats"
          description="Keep the right tools panel open by default."
          checked={showReadabilityPanel}
          onChange={onReadabilityChange}
        />
      </SettingsGroup>

      <SettingsGroup
        label="While typing"
        hint="Applies when both sidebars are closed."
      >
        <ToggleRow
          id="keep-top-bar-visible-while-typing"
          label="Top bar"
          description="Tabs and sidebar toggles stay visible."
          checked={focusVisibilityPrefs.keepTopBarVisibleWhileTyping}
          onChange={(v) => onFocusVisibilityPrefChange({ keepTopBarVisibleWhileTyping: v })}
        />
        <ToggleRow
          id="keep-document-title-visible-while-typing"
          label="File name"
          description="Document title and unsaved indicator."
          checked={focusVisibilityPrefs.keepDocumentTitleVisibleWhileTyping}
          onChange={(v) =>
            onFocusVisibilityPrefChange({ keepDocumentTitleVisibleWhileTyping: v })
          }
        />
        <ToggleRow
          id="keep-bottom-tools-visible-while-typing"
          label="Bottom tools"
          description="Sidebar, timer, and copy controls."
          checked={focusVisibilityPrefs.keepBottomToolsVisibleWhileTyping}
          onChange={(v) => onFocusVisibilityPrefChange({ keepBottomToolsVisibleWhileTyping: v })}
        />
      </SettingsGroup>

      <SettingsGroup label="Coming soon">
        <ToggleRow
          id="focus-mode"
          label="Focus mode"
          description="Dim chrome around the editor."
          checked={focusMode}
          onChange={onFocusModeChange}
        />
        <ToggleRow
          id="typewriter-scroll"
          label="Typewriter scrolling"
          description="Keep the caret at a fixed vertical position."
          checked={typewriterScroll}
          onChange={onTypewriterChange}
        />
      </SettingsGroup>
    </div>
  );
}

function ParametersPanel({
  prefs,
  onChange,
}: {
  prefs: ParametersPrefs;
  onChange: (partial: Partial<ParametersPrefs>) => void;
}) {
  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Parameters"
        description="Numbers used for reading stats and Edit highlights."
      />

      <div className="space-y-2 rounded-lg bg-mist/80 px-3.5 py-3 dark:bg-ink/[0.035]">
        <div>
          <p className="text-[13px] font-medium text-ink">Reading grade</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
            Flesch–Kincaid U.S. grade level for the document.
          </p>
        </div>
        <div className="font-mono text-[11px] leading-relaxed text-muted/80">
          <p>0.39 × (words ÷ sentences) + 11.8 × (syllables ÷ words) − 15.59</p>
        </div>
      </div>

      <label className="flex items-start justify-between gap-4 rounded-lg bg-mist/80 px-3.5 py-3 dark:bg-ink/[0.035]">
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
          className="w-[4.5rem] shrink-0 rounded-md border-0 bg-canvas/45 px-2 py-1.5 text-right text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-ink/20 dark:bg-canvas/35"
        />
      </label>

      <div className="space-y-2 rounded-lg bg-mist/80 px-3.5 py-3 dark:bg-ink/[0.035]">
        <label className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink">Sentence complexity</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted/75">
              Highlight sentences at or above this F–K density. Suggested{" "}
              {SUGGESTED_FK_COMPLEXITY_THRESHOLD_MIN}–{SUGGESTED_FK_COMPLEXITY_THRESHOLD_MAX}.
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
            className="w-[4.5rem] shrink-0 rounded-md border-0 bg-canvas/45 px-2 py-1.5 text-right text-[13px] text-ink outline-none ring-1 ring-line/20 focus:ring-ink/20 dark:bg-canvas/35"
          />
        </label>
        <div className="font-mono text-[11px] leading-relaxed text-muted/80">
          <p>0.39 × words + 11.8 × (syllables ÷ words) − 15.59 ≥ {prefs.fkComplexityThreshold}</p>
        </div>
      </div>
    </div>
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
          <ul
            className={`${SETTINGS_DIVIDE_Y} overflow-hidden rounded-lg bg-mist/80 dark:bg-ink/[0.035]`}
          >
            {group.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 px-3 py-2.5"
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
    <li className="flex items-start justify-between gap-4 px-3 py-3">
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
          checked ? "harvy-settings-switch--on bg-ink" : "harvy-settings-switch--off"
        } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
      >
        <span
          aria-hidden
          className={`harvy-settings-switch-knob pointer-events-none absolute left-0.5 top-0.5 block h-5 w-5 rounded-full transition-[transform,background-color,box-shadow] duration-200 ease-out ${
            checked ? "translate-x-4 bg-page shadow" : "translate-x-0"
          }`}
        />
      </button>
    </li>
  );
}

function FilesPanel({
  workspaceRootPath,
  onChooseWorkspaceFolder,
}: {
  workspaceRootPath: string | null;
  onChooseWorkspaceFolder?: () => void | Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Files"
        description="Harvy only reads and writes inside this folder."
      />
      <div className="rounded-lg bg-mist/90 px-3.5 py-3 dark:bg-ink/[0.04]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
          Workspace
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
          className="mt-3 rounded-md bg-ink/[0.06] px-3 py-2 text-[12px] font-medium text-ink transition-colors hover:bg-ink/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
        >
          {workspaceRootPath ? "Change folder" : "Choose folder"}
        </button>
      </div>
    </div>
  );
}

function SettingsAboutSection() {
  return (
    <div className="space-y-5">
      <SettingsSectionHeader title="About" />
      <div className="space-y-2 rounded-lg bg-mist/80 px-3.5 py-3 dark:bg-ink/[0.035]">
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
