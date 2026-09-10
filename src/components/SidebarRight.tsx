import { ChevronRight, Info, Zap } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { EditorStats } from "../features/editor/stats";
import {
  visibleWriteSidebarModes,
  type SidebarToolsMode,
} from "../features/sidebar/sidebarToolsMode";
import type { ProofreadIssue } from "../features/proofread/types";
import type { WorkspaceSection } from "../features/workspace/workspaceSection";
import { CriteriaSidebarPanel } from "./CriteriaSidebarPanel";
import { NotesSidebarPanel } from "./NotesSidebarPanel";
import type { FileNode } from "../features/workspace/types";
import type { RelatedEssayItem } from "../features/related-essays/relatedEssays";

const PANEL =
  "relative flex h-full min-h-0 w-full flex-col bg-stage font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-ink antialiased [backdrop-filter:none]";

const LABEL = "text-left text-[14px] font-normal leading-snug text-muted/80";

const VALUE =
  "flex shrink-0 items-center justify-end text-right text-[14px] font-medium tabular-nums tracking-tight text-ink";

const DIVIDER = "h-px w-full bg-line/35";
const COMPACT_SECTION_GAP = "my-6";
const COMPACT_ROWS_GAP = "space-y-3";

const TAB_LABELS: Record<SidebarToolsMode, string> = {
  notes: "Notes",
  edit: "Edit",
  criteria: "Criteria",
};

/** 2px rail — +4px vs column width, centered (2px each side); self-center avoids flex stretch overriding width. */
const TAB_UNDERLINE_TRACK =
  "pointer-events-none block h-[2px] min-h-[2px] max-h-[2px] w-[calc(100%+4px)] shrink-0 self-center rounded-sm";

export type SidebarRightProps = {
  stats: EditorStats;
  mode: SidebarToolsMode;
  onModeChange: (mode: SidebarToolsMode) => void;
  /** Words in current textarea selection; `null` when caret only or focus outside editor. */
  selectedWordCount: number | null;
  notes: string;
  onNotesChange: (value: string) => void;
  criteria: string;
  onCriteriaChange: (value: string) => void;
  /** Toggle the separate Notes pop-out window. */
  onToggleNotesPopout?: () => void;
  /** When on, Quick Links appears below Notes. */
  showQuickLinks?: boolean;
  relatedSourcePath?: string;
  relatedTitle?: string;
  relatedExcerpt?: string;
  workspaceTree?: FileNode | null;
  relatedAiReady?: boolean;
  onRelatedItemsFound?: (items: RelatedEssayItem[]) => Promise<string | null>;
  /** When on, Criteria appears as a tools tab (Write). */
  showCriteria?: boolean;
  proofreadIssues?: ProofreadIssue[];
  workspaceSection?: WorkspaceSection;
  /** When AI check is configured + enabled in Settings. */
  aiCheckEnabled?: boolean;
  /** Friendly model name for Info (e.g. "Claude Fable 5"). */
  aiCheckModelLabel?: string | null;
  aiCheckRunning?: boolean;
  /** Estimated or actual cost line for Info (e.g. "~$0.02"). */
  aiCheckCostLabel?: string | null;
  /** Error message from the last run, if any. */
  aiCheckError?: string | null;
  onRunAiCheck?: () => void | Promise<void>;
};

function SidebarToolsTab({
  tab,
  current,
  onSelect,
}: {
  tab: SidebarToolsMode;
  current: SidebarToolsMode;
  onSelect: (mode: SidebarToolsMode) => void;
}) {
  const active = current === tab;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      id={`harvy-sidebar-tab-${tab}`}
      onClick={() => onSelect(tab)}
      className="group flex min-w-0 flex-col items-stretch gap-1 py-0.5 text-center"
    >
      <span
        className={`text-[12px] font-medium leading-normal tracking-wide transition-colors ${
          active ? "text-ink" : "text-muted/60 group-hover:text-muted/85"
        }`}
      >
        {TAB_LABELS[tab]}
      </span>
      <span
        aria-hidden
        className={`${TAB_UNDERLINE_TRACK} transition-[background-color] duration-150 ${
          active ? "bg-accent" : "bg-transparent"
        }`}
      />
    </button>
  );
}

function LabelAccent({ text, colorHex }: { text: string; colorHex: string }) {
  return (
    <span className="harvy-sidebar-prose-legend" style={{ ["--harvy-legend-color" as string]: colorHex }}>
      {text}
    </span>
  );
}

function ProofreadLabelAccent({
  text,
  type,
}: {
  text: string;
  type: "spelling" | "grammar" | "suggestion" | "ai";
}) {
  const dotColorByType: Record<typeof type, string> = {
    spelling: "#e5484d",
    grammar: "#3a7bd5",
    suggestion: "#2fbf71",
    ai: "#22d3ee",
  };
  const style = {
    "--proofread-dot-color": dotColorByType[type],
  } as CSSProperties;
  return (
    <span className={`proofread-label proofread-label-${type}`} style={style}>
      {text}
    </span>
  );
}

function StatRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className={LABEL}>{label}</div>
      <div className={VALUE}>{value}</div>
    </div>
  );
}

function ReadingTimeInfoTooltip({ wordsPerMinute }: { wordsPerMinute: number }) {
  return (
    <span className="relative inline-flex items-center">
      <span className="peer inline-flex items-center">
        <Info
          size={13}
          aria-label="Reading time information"
          className="ml-1.5 shrink-0 text-muted/70"
        />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] font-normal text-canvas opacity-0 shadow-md transition-opacity duration-150 peer-hover:opacity-100">
        {wordsPerMinute} words/min
      </span>
    </span>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p className="mb-[10px] text-[11px] font-medium uppercase tracking-[0.1em] text-muted/70">{text}</p>;
}

function EditSidebarView({
  stats,
  selectedWordCount,
  proofreadIssues = [],
  aiCheckEnabled = false,
  aiCheckModelLabel = null,
  aiCheckRunning = false,
  aiCheckCostLabel = null,
  aiCheckError = null,
  onRunAiCheck,
}: {
  stats: EditorStats;
  selectedWordCount: number | null;
  proofreadIssues?: ProofreadIssue[];
  aiCheckEnabled?: boolean;
  aiCheckModelLabel?: string | null;
  aiCheckRunning?: boolean;
  aiCheckCostLabel?: string | null;
  aiCheckError?: string | null;
  onRunAiCheck?: () => void | Promise<void>;
}) {
  const spellings = proofreadIssues.filter((i) => i.type === "spelling").length;
  const grammar = proofreadIssues.filter((i) => i.type === "grammar").length;
  const suggestions = proofreadIssues.filter((i) => i.type === "suggestion").length;
  const aiIssues = proofreadIssues.filter((i) => i.type === "ai").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-[1.45rem] font-semibold leading-none tracking-[-0.02em] text-ink">Edit</h2>
      </header>

      <div className={`${DIVIDER} my-6`} aria-hidden />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SectionLabel text="Document" />

        <div className={COMPACT_ROWS_GAP}>
          <StatRow label="Reading Grade" value={stats.gradeLabel} />
          <StatRow
            label={
              <span className="inline-flex items-center">
                <span className="inline-flex items-center">
                  Reading time
                  <ReadingTimeInfoTooltip wordsPerMinute={stats.readingWordsPerMinute} />
                </span>
              </span>
            }
            value={stats.readingTimeFormatted}
          />
          <StatRow
            label="Word Count"
            value={selectedWordCount && selectedWordCount > 0 ? `${selectedWordCount} of ${stats.words}` : stats.words}
          />
        </div>

        <div className={`${DIVIDER} ${COMPACT_SECTION_GAP}`} aria-hidden />

        <SectionLabel text="Prose" />

        <div className={COMPACT_ROWS_GAP}>
          <StatRow
            label={<LabelAccent text="Adverbs / Hedging" colorHex="#8b5cf6" />}
            value={stats.adverbs}
          />
          <StatRow
            label={<LabelAccent text="Passive Voice" colorHex="#2fbf71" />}
            value={stats.passiveVoiceSentences}
          />
          <StatRow
            label={<LabelAccent text="Complex Sentences" colorHex="#f08c2e" />}
            value={stats.complexSentences}
          />
        </div>

        <div className={`${DIVIDER} ${COMPACT_SECTION_GAP}`} aria-hidden />

        <SectionLabel text="Mechanics" />

        <div className={COMPACT_ROWS_GAP}>
          <StatRow label={<ProofreadLabelAccent text="Spellings" type="spelling" />} value={spellings} />
          <StatRow label={<ProofreadLabelAccent text="Grammar" type="grammar" />} value={grammar} />
          <StatRow
            label={<ProofreadLabelAccent text="Suggestions" type="suggestion" />}
            value={suggestions}
          />
          {aiCheckEnabled || aiIssues > 0 ? (
            <StatRow label={<ProofreadLabelAccent text="AI check" type="ai" />} value={aiIssues} />
          ) : null}
        </div>

        {aiCheckEnabled ? (
          <AiCheckRunControls
            modelLabel={aiCheckModelLabel}
            running={aiCheckRunning}
            costLabel={aiCheckCostLabel}
            error={aiCheckError}
            onRun={onRunAiCheck}
          />
        ) : null}
      </div>
    </div>
  );
}

function AiCheckRunControls({
  modelLabel,
  running,
  costLabel,
  error,
  onRun,
}: {
  modelLabel: string | null;
  running: boolean;
  costLabel: string | null;
  error: string | null;
  onRun?: () => void | Promise<void>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  /** Local busy flag so the label updates on click without waiting for AppShell to re-render. */
  const [pending, setPending] = useState(false);
  const busy = running || pending;
  const hasInfo = Boolean(modelLabel || costLabel || error);

  return (
    <div className="mt-5 space-y-2.5">
      <button
        type="button"
        disabled={busy || !onRun}
        onClick={() => {
          if (!onRun || busy) return;
          setPending(true);
          void Promise.resolve(onRun()).finally(() => setPending(false));
        }}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-ink bg-transparent px-3 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-ink/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Zap size={14} strokeWidth={2} aria-hidden className="shrink-0" />
        <span>{busy ? "Running..." : "Run AI Check"}</span>
      </button>

      {hasInfo ? (
        <div>
          <button
            type="button"
            onClick={() => setInfoOpen((open) => !open)}
            className="inline-flex items-center gap-1 text-[12px] text-muted/70 transition-colors hover:text-muted"
            aria-expanded={infoOpen}
          >
            <ChevronRight
              size={12}
              strokeWidth={2}
              aria-hidden
              className={`shrink-0 transition-transform ${infoOpen ? "rotate-90" : ""}`}
            />
            Info
          </button>
          {infoOpen ? (
            <div className="mt-1.5 space-y-1.5 pl-4">
              {modelLabel ? (
                <p className="text-[12px] leading-snug text-muted/75">
                  Model: <span className="font-medium text-ink">{modelLabel}</span>
                </p>
              ) : null}
              {costLabel ? (
                <p className="text-[12px] leading-snug text-muted/75">
                  Cost: <span className="font-medium text-ink">{costLabel}</span>
                </p>
              ) : null}
              {error ? (
                <p className="text-[12px] leading-snug text-red-600/90 dark:text-red-400/90">{error}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarRight({
  stats,
  mode,
  onModeChange,
  selectedWordCount,
  notes,
  onNotesChange,
  criteria,
  onCriteriaChange,
  onToggleNotesPopout,
  showQuickLinks = false,
  relatedSourcePath = "",
  relatedTitle = "",
  relatedExcerpt = "",
  workspaceTree = null,
  relatedAiReady = false,
  onRelatedItemsFound,
  showCriteria = true,
  proofreadIssues = [],
  workspaceSection = "write",
  aiCheckEnabled = false,
  aiCheckModelLabel = null,
  aiCheckRunning = false,
  aiCheckCostLabel = null,
  aiCheckError = null,
  onRunAiCheck,
}: SidebarRightProps) {
  const writeTabs = useMemo(
    () => visibleWriteSidebarModes({ showCriteria }),
    [showCriteria],
  );
  const tabColsClass =
    writeTabs.length >= 3 ? "grid-cols-3" : writeTabs.length === 2 ? "grid-cols-2" : "grid-cols-1";

  if (workspaceSection === "collect") {
    return (
      <div className={PANEL}>
        <div
          id="harvy-tools-panel"
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-7 pb-8 pt-3"
        >
          <NotesSidebarPanel
            notes={notes}
            onNotesChange={onNotesChange}
            onTogglePopout={onToggleNotesPopout}
            showQuickLinks={showQuickLinks}
            sourcePath={relatedSourcePath}
            relatedTitle={relatedTitle}
            relatedExcerpt={relatedExcerpt}
            workspaceTree={workspaceTree}
            aiReady={relatedAiReady}
            onRelatedItemsFound={onRelatedItemsFound}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={PANEL}>
      {/* pt-1 mirrors SidebarLeft first block after the tab-bar chrome band (toggle → content rhythm) */}
      <div
        className={`grid shrink-0 items-end gap-x-5 px-7 pb-3 pt-1 ${tabColsClass}`}
        role="tablist"
        aria-label="Tools"
      >
        {writeTabs.map((tab) => (
          <SidebarToolsTab key={tab} tab={tab} current={mode} onSelect={onModeChange} />
        ))}
      </div>

      <div
        id="harvy-tools-panel"
        className="flex min-h-0 flex-1 flex-col overflow-hidden px-7 pb-8 pt-2"
        role="tabpanel"
        aria-labelledby={`harvy-sidebar-tab-${mode}`}
      >
        {mode === "notes" ? (
          <NotesSidebarPanel
            notes={notes}
            onNotesChange={onNotesChange}
            onTogglePopout={onToggleNotesPopout}
            showQuickLinks={showQuickLinks}
            sourcePath={relatedSourcePath}
            relatedTitle={relatedTitle}
            relatedExcerpt={relatedExcerpt}
            workspaceTree={workspaceTree}
            aiReady={relatedAiReady}
            onRelatedItemsFound={onRelatedItemsFound}
          />
        ) : mode === "criteria" ? (
          <CriteriaSidebarPanel criteria={criteria} onCriteriaChange={onCriteriaChange} />
        ) : (
          <EditSidebarView
            stats={stats}
            selectedWordCount={selectedWordCount}
            proofreadIssues={proofreadIssues}
            aiCheckEnabled={aiCheckEnabled}
            aiCheckModelLabel={aiCheckModelLabel}
            aiCheckRunning={aiCheckRunning}
            aiCheckCostLabel={aiCheckCostLabel}
            aiCheckError={aiCheckError}
            onRunAiCheck={onRunAiCheck}
          />
        )}
      </div>
    </div>
  );
}
