import type { EditorCommand } from "../features/editor/commands";
import type { SidebarToolsMode } from "../features/sidebar/sidebarToolsMode";

type Tool = { label: string; command: EditorCommand };

const TOOL_GROUPS: Tool[][] = [
  [
    { label: "Bold", command: "bold" },
    { label: "Italic", command: "italic" },
  ],
  [
    { label: "H1", command: "h1" },
    { label: "H2", command: "h2" },
    { label: "H3", command: "h3" },
  ],
  [{ label: "Quote", command: "quote" }],
  [
    { label: "Bullets", command: "bullets" },
    { label: "Numbers", command: "numbers" },
  ],
  [{ label: "Link", command: "link" }],
];

const TOOL_BTN_BASE =
  "select-none rounded-md px-2 py-1 text-[11px] font-medium tracking-tight transition-colors";

const TOOL_BTN_ENABLED = `${TOOL_BTN_BASE} text-muted/80 hover:bg-ink/[0.06] hover:text-ink active:bg-ink/[0.09]`;
const TOOL_BTN_DISABLED = `${TOOL_BTN_BASE} cursor-not-allowed text-muted/40`;

type EditorToolbarProps = {
  mode: SidebarToolsMode;
  onRunCommand: (command: EditorCommand) => void;
};

export function EditorToolbar({ mode, onRunCommand }: EditorToolbarProps) {
  const enabled = mode === "edit";

  return (
    <div
      className={
        enabled
          ? "mx-auto w-full max-w-[820px] shrink-0 border-b border-line/[0.1] bg-stage px-3 py-1.5"
          : "mx-auto w-full max-w-[820px] shrink-0 border-b border-transparent bg-stage/80 px-3 py-1.5"
      }
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-6"
      >
        {TOOL_GROUPS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-x-1">
            {group.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={!enabled}
                onClick={() => onRunCommand(item.command)}
                className={enabled ? TOOL_BTN_ENABLED : TOOL_BTN_DISABLED}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
