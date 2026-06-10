import { Info } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { EditorStats } from "../features/editor/stats";
import { SIDEBAR_TOOLS_MODES, type SidebarToolsMode } from "../features/sidebar/sidebarToolsMode";
import type { ProofreadIssue } from "../features/proofread/types";
import { NotesSidebarPanel } from "./NotesSidebarPanel";

const PANEL =
  "relative flex h-full min-h-0 w-full flex-col bg-stage font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-ink antialiased [backdrop-filter:none]";

const LABEL = "text-left text-[14px] font-normal leading-snug text-muted/80";

const VALUE =
  "flex shrink-0 items-center justify-end text-right text-[14px] font-medium tabular-nums tracking-tight text-ink";

const DIVIDER = "h-px w-full bg-line/35";
const COMPACT_SECTION_GAP = "my-6";
const COMPACT_ROWS_GAP = "space-y-3";

const TAB_LABELS: Record<SidebarToolsMode, string> = {
  notes: "Note",
  edit: "Edit",
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
  proofreadIssues?: ProofreadIssue[];
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
        className={`text-[11px] font-medium leading-normal tracking-wide transition-colors ${
          active ? "text-ink" : "text-muted/60 group-hover:text-muted/85"
        }`}
      >
        {TAB_LABELS[tab]}
      </span>
      <span
        aria-hidden
        className={`${TAB_UNDERLINE_TRACK} transition-[background-color] duration-150 ${
          active ? "bg-[#6f6f6f]" : "bg-transparent"
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

function ProofreadLabelAccent({ text, type }: { text: string; type: "spelling" | "grammar" | "suggestion" }) {
  const dotColorByType: Record<typeof type, string> = {
    spelling: "#e5484d",
    grammar: "#3a7bd5",
    suggestion: "#2fbf71",
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

function ReadingTimeInfoTooltip() {
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
        300 words/min
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
}: {
  stats: EditorStats;
  selectedWordCount: number | null;
  proofreadIssues?: ProofreadIssue[];
}) {
  const spellings = proofreadIssues.filter((i) => i.type === "spelling").length;
  const grammar = proofreadIssues.filter((i) => i.type === "grammar").length;
  const suggestions = proofreadIssues.filter((i) => i.type === "suggestion").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-[1.45rem] font-semibold leading-none tracking-[-0.02em] text-ink">Edit</h2>
      </header>

      <div className={`${DIVIDER} my-6`} aria-hidden />

      <div className="min-h-0 flex-1 overflow-hidden">
        <SectionLabel text="Document" />

        <div className={COMPACT_ROWS_GAP}>
          <StatRow label="Reading Grade" value={stats.gradeLabel} />
          <StatRow
            label={
              <span className="inline-flex items-center">
                <span className="inline-flex items-center">
                  Reading time
                  <ReadingTimeInfoTooltip />
                </span>
              </span>
            }
            value={stats.readingTimeAt300Wpm}
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
        </div>
      </div>
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
  proofreadIssues = [],
}: SidebarRightProps) {
  return (
    <div className={PANEL}>
      {/* pt-1 mirrors SidebarLeft first block after the h-8 chrome band (toggle → content rhythm) */}
      <div
        className="grid shrink-0 grid-cols-2 items-end gap-x-5 px-7 pb-3 pt-1"
        role="tablist"
        aria-label="Tools"
      >
        {SIDEBAR_TOOLS_MODES.map((tab) => (
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
          <NotesSidebarPanel notes={notes} onNotesChange={onNotesChange} />
        ) : (
          <EditSidebarView
            stats={stats}
            selectedWordCount={selectedWordCount}
            proofreadIssues={proofreadIssues}
          />
        )}
      </div>
    </div>
  );
}
