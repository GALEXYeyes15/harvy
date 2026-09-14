import type { CSSProperties } from "react";
import {
  workspaceSectionLabel,
  type WorkspaceSection,
} from "../features/workspace/workspaceSection";

/** Match workspace/readability sidebar rail timing (`duration-500 ease-in-out`). */
const RAIL_MOTION_CLASS =
  "transition-[left,opacity,transform] duration-500 ease-in-out";

type WorkspaceSectionSwitcherProps = {
  activeSection: WorkspaceSection;
  onSectionChange: (section: WorkspaceSection) => void;
  sections: WorkspaceSection[];
  /** When only one Research sub-view is enabled, the rail label uses that name. */
  showOutliersView?: boolean;
  showCollectView?: boolean;
  showHeadlinesView?: boolean;
  showAvatarView?: boolean;
  /** Shared with top chrome (tabs, header, ambient controls) during distraction-free writing. */
  chromeHidden?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function WorkspaceSectionSwitcher({
  activeSection,
  onSectionChange,
  sections,
  showOutliersView = true,
  showCollectView = true,
  showHeadlinesView = true,
  showAvatarView = true,
  chromeHidden = false,
  className,
  style,
}: WorkspaceSectionSwitcherProps) {
  return (
    <nav
      className={[
        "pointer-events-none flex w-[3.25rem] shrink-0 flex-col items-stretch justify-start bg-transparent pl-1 pr-2",
        RAIL_MOTION_CLASS,
        chromeHidden
          ? "pointer-events-none -translate-y-2 opacity-0"
          : "translate-y-0 opacity-100",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-label="Workspace sections"
    >
      <div className="flex w-full flex-col items-stretch gap-1.5">
      {sections.map((section) => {
        const active = activeSection === section;
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSectionChange(section)}
            aria-current={active ? "page" : undefined}
            className={`group relative flex w-full items-center justify-start py-1 pl-2 pr-1 text-left ${
              chromeHidden ? "pointer-events-none" : "pointer-events-auto"
            } ${active ? "text-ink" : "text-accent/60"}`}
          >
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 left-0 w-[2px] rounded-full transition-colors duration-150 ${
                active ? "bg-current" : "bg-transparent group-hover:bg-current"
              }`}
            />
            <span
              className={`text-[12px] font-semibold leading-snug tracking-wide transition-colors ${
                active ? "text-ink" : ""
              }`}
            >
              {workspaceSectionLabel(section, {
                showOutliersView,
                showCollectView,
                showHeadlinesView,
                showAvatarView,
              })}
            </span>
          </button>
        );
      })}
      </div>
    </nav>
  );
}

export function WorkspaceSectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-stage px-6">
      <p className="text-[15px] font-medium tracking-tight text-muted/70">{title}</p>
    </div>
  );
}
