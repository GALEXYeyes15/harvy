import type { ReactNode } from "react";

type WorkspaceSectionMainContentProps = {
  children: ReactNode;
};

/** Shared scroll + horizontal padding for Collect main content. */
export function WorkspaceSectionMainContent({ children }: WorkspaceSectionMainContentProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-10 sm:px-14">
      {children}
    </div>
  );
}
