import { useState } from "react";
import { APP_NAME } from "../../lib/constants";
import type { FocusVisibilityPrefs } from "../../features/editor/focusVisibilitySettings";
import type { ThemeMode } from "../../theme/themeMode";
import { CenteredOverlayModal } from "../overlay/CenteredOverlayModal";
import { SETTINGS_NAV, type SettingsSectionId } from "./sectionIds";

/** macOS System Settings–like window: ~1150×800, capped at 90vw / 90vh. */
const SETTINGS_PANEL_SIZE =
  "h-[min(400px,90vh)] w-[min(900px,90vw)] max-h-[90vh] max-w-[90vw]";

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
  enableCollect: boolean;
  onEnableCollectChange: (enabled: boolean) => void;
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
  enableCollect,
  onEnableCollectChange,
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
              <GeneralPanel enableCollect={enableCollect} onEnableCollectChange={onEnableCollectChange} />
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
                focusMode={focusMode}
                onFocusModeChange={setFocusMode}
                typewriterScroll={typewriterScroll}
                onTypewriterChange={setTypewriterScroll}
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

function GeneralPanel({
  enableCollect,
  onEnableCollectChange,
}: {
  enableCollect: boolean;
  onEnableCollectChange: (enabled: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">General</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted/90">
          Workspace and application behavior.
        </p>
      </div>
      <ul className={`${SETTINGS_DIVIDE_Y} overflow-hidden rounded-lg bg-mist/80 dark:bg-ink/[0.035]`}>
        <ToggleRow
          id="enable-collect"
          label="Enable Collect"
          description="Show Collect in the left workspace navigation for saving research and inspiration."
          checked={enableCollect}
          onChange={onEnableCollectChange}
        />
      </ul>
      <div className="rounded-lg bg-mist/90 px-3.5 py-3 dark:bg-ink/[0.04]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">App name</p>
        <p className="mt-1 text-[14px] font-medium tracking-tight text-ink">{APP_NAME}</p>
      </div>
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
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">Appearance</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted/90">Choose how Harvy matches your environment.</p>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">Theme</p>
        <div
          className="inline-flex rounded-lg bg-mist/90 p-1 dark:bg-ink/[0.04]"
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
          Theme preference is saved in local storage and restored when you reopen Harvy.
        </p>
      </div>
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
  focusMode: boolean;
  onFocusModeChange: (v: boolean) => void;
  typewriterScroll: boolean;
  onTypewriterChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">Editor</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted/90">Writing surface and distraction options.</p>
      </div>
      <ul className={`${SETTINGS_DIVIDE_Y} overflow-hidden rounded-lg bg-mist/80 dark:bg-ink/[0.035]`}>
        <ToggleRow
          id="spellcheck"
          label="Spellcheck"
          description="Uses the system dictionary in the editor. Misspellings are underlined; nothing is changed unless you choose a suggestion."
          checked={spellcheckEnabled}
          onChange={onSpellcheckChange}
        />
        <ToggleRow
          id="grammar-checks"
          label="Writing hints"
          description="Light editorial underlines (spacing, repetition, gentle style cues). Right-click for optional fixes where available."
          checked={grammarChecksEnabled}
          onChange={onGrammarChecksChange}
        />
        <ToggleRow
          id="readability-panel"
          label="Show readability panel"
          description="Right-side tools and stats while you write."
          checked={showReadabilityPanel}
          onChange={onReadabilityChange}
        />
        <ToggleRow
          id="focus-mode"
          label="Focus mode"
          description="Placeholder — dims chrome around the editor."
          checked={focusMode}
          onChange={onFocusModeChange}
        />
        <ToggleRow
          id="typewriter-scroll"
          label="Typewriter scrolling"
          description="Placeholder — keeps the caret in a fixed vertical position."
          checked={typewriterScroll}
          onChange={onTypewriterChange}
        />
      </ul>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">
          Focus visibility
        </p>
        <ul className={`${SETTINGS_DIVIDE_Y} overflow-hidden rounded-lg bg-mist/80 dark:bg-ink/[0.035]`}>
          <ToggleRow
            id="keep-top-bar-visible-while-typing"
            label="Keep top bar visible while typing"
            description="Tab bar, sidebar toggles, and tab navigation when both sidebars are closed."
            checked={focusVisibilityPrefs.keepTopBarVisibleWhileTyping}
            onChange={(v) => onFocusVisibilityPrefChange({ keepTopBarVisibleWhileTyping: v })}
          />
          <ToggleRow
            id="keep-document-title-visible-while-typing"
            label="Keep document title visible while typing"
            description="Document name and unsaved indicator when both sidebars are closed."
            checked={focusVisibilityPrefs.keepDocumentTitleVisibleWhileTyping}
            onChange={(v) => onFocusVisibilityPrefChange({ keepDocumentTitleVisibleWhileTyping: v })}
          />
          <ToggleRow
            id="keep-bottom-tools-visible-while-typing"
            label="Keep bottom tools visible while typing"
            description="Bottom-center sidebar, timer, and copy controls when both sidebars are closed."
            checked={focusVisibilityPrefs.keepBottomToolsVisibleWhileTyping}
            onChange={(v) => onFocusVisibilityPrefChange({ keepBottomToolsVisibleWhileTyping: v })}
          />
        </ul>
      </div>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4 px-3 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        <p className="mt-0.5 text-[11px] leading-snug text-muted/85">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`harvy-settings-switch relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-[background-color,box-shadow,border-color] duration-200 ${
          checked ? "harvy-settings-switch--on bg-ink" : "harvy-settings-switch--off"
        }`}
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
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">Files</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted/90">
          Harvy only reads and writes inside the folder you choose.
        </p>
      </div>
      <div className="rounded-lg bg-mist/90 px-3.5 py-3 dark:bg-ink/[0.04]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">Workspace folder</p>
        {workspaceRootPath ? (
          <p className="mt-1 break-all text-[13px] font-medium tracking-tight text-ink">{workspaceRootPath}</p>
        ) : (
          <p className="mt-1 text-[13px] font-medium tracking-tight text-muted/80">No folder selected</p>
        )}
        <button
          type="button"
          onClick={() => void onChooseWorkspaceFolder?.()}
          className="mt-3 rounded-md bg-ink/[0.06] px-3 py-2 text-[12px] font-medium text-ink transition-colors hover:bg-ink/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
        >
          {workspaceRootPath ? "Change Folder" : "Choose Folder"}
        </button>
      </div>
    </div>
  );
}

function SettingsAboutSection() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">About</h2>
      </div>
      <div className="space-y-2">
        <p className="text-[14px] font-semibold tracking-tight text-ink">
          {APP_NAME} <span className="font-normal text-muted/80">v0.1.0</span>
        </p>
        <p className="max-w-md text-[12px] leading-relaxed text-muted/90">
          Harvy is a calm, writing-focused workspace for drafting and refining text alongside your files.
        </p>
      </div>
    </div>
  );
}
