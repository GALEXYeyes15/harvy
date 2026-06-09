import type { CSSProperties } from "react";
import {
  WORKSPACE_SECTION_LABELS,
  WORKSPACE_SECTIONS,
  type WorkspaceSection,
} from "../features/workspace/workspaceSection";

type WorkspaceSectionSwitcherProps = {
  activeSection: WorkspaceSection;
  onSectionChange: (section: WorkspaceSection) => void;
  className?: string;
  style?: CSSProperties;
};

export function WorkspaceSectionSwitcher({
  activeSection,
  onSectionChange,
  className,
  style,
}: WorkspaceSectionSwitcherProps) {
  return (
    <nav
      className={[
        "pointer-events-none flex w-[3.25rem] shrink-0 flex-col items-stretch justify-start bg-transparent pl-1 pr-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-label="Workspace sections"
    >
      <div className="flex w-full flex-col items-stretch gap-1.5">
      {WORKSPACE_SECTIONS.map((section) => {
        const active = activeSection === section;
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSectionChange(section)}
            aria-current={active ? "page" : undefined}
            className={`pointer-events-auto group relative flex w-full items-center justify-start py-1 pl-2 pr-1 text-left transition-colors ${
              active ? "text-ink" : "text-muted/55 hover:text-muted/90"
            }`}
          >
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 left-0 w-[2px] rounded-full transition-colors duration-150 ${
                active ? "bg-[#6f6f6f]" : "bg-transparent group-hover:bg-line/25"
              }`}
            />
            <span
              className={`text-[12px] font-semibold leading-snug tracking-wide transition-colors ${
                active ? "text-ink" : ""
              }`}
            >
              {WORKSPACE_SECTION_LABELS[section]}
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
