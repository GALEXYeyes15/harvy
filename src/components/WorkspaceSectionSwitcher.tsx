import type { CSSProperties } from "react";
import { Lightbulb, Pencil, type LucideIcon } from "lucide-react";
import {
  workspaceSectionLabel,
  type WorkspaceSection,
} from "../features/workspace/workspaceSection";

/** Match workspace/readability sidebar rail timing (`duration-500 ease-in-out`). */
const RAIL_MOTION_CLASS =
  "transition-[left,opacity,transform] duration-500 ease-in-out";

const SECTION_ICONS: Record<WorkspaceSection, LucideIcon> = {
  collect: Lightbulb,
  write: Pencil,
};

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
        "pointer-events-none flex w-8 flex-col items-center bg-transparent",
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
      <div className="flex w-8 flex-col items-center">
      {sections.map((section) => {
        const active = activeSection === section;
        const label = workspaceSectionLabel(section, {
          showOutliersView,
          showCollectView,
          showHeadlinesView,
          showAvatarView,
        });
        const Icon = SECTION_ICONS[section];
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSectionChange(section)}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={label}
            className={`flex h-8 w-8 items-center justify-center transition-colors ${
              chromeHidden ? "pointer-events-none" : "pointer-events-auto"
            } ${
              active
                ? "text-ink dark:text-white"
                : "text-accent hover:text-ink dark:hover:text-white"
            }`}
          >
            <Icon aria-hidden size={17} strokeWidth={1.5} />
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
