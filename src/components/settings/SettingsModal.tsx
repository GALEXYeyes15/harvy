import { useState, type ReactNode } from "react";
import { SquareArrowOutUpRight } from "lucide-react";
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
import type { ThemeMode } from "../../theme/themeMode";
import { CenteredOverlayModal } from "../overlay/CenteredOverlayModal";
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
              <AppearancePanel themeMode={themeMode} onThemeModeChange={onThemeModeChange} />
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
    </div>
  );
}

function AppearancePanel({
  themeMode,
  onThemeModeChange,
}: {
  themeMode: ThemeMode;
  onThemeModeChange: (t: ThemeMode) => void;
}) {
  const options: { id: ThemeMode; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "System" },
    { id: "cyber", label: "Cyber" },
  ];

  return (
    <div className="space-y-5">
      <SettingsSectionHeader title="Appearance" description="Color theme for the app." />
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
          Theme
        </p>
        <div
          className="inline-flex flex-wrap rounded-lg bg-mist/90 p-1 dark:bg-ink/[0.04]"
          role="radiogroup"
          aria-label="Color theme"
        >
          {options.map((opt) => {
            const selected = themeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onThemeModeChange(opt.id)}
                className={
                  selected
                    ? "rounded-md bg-page px-3 py-1.5 text-[12px] font-medium text-ink shadow-sm dark:bg-page/80"
                    : "rounded-md px-3 py-1.5 text-[12px] font-normal text-muted/85 transition-colors hover:text-ink"
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted/70">
          {themeMode === "cyber"
            ? "Dark surfaces, cyan accents, and mono typing. Saved for next launch."
            : "Saved automatically and restored next time you open Harvy."}
        </p>
      </div>
    </div>
  );
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
