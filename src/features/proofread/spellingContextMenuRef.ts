import type { ProofreadIssue } from "./types";

/** Live spelling menu state for the editor context menu (no React remount on update). */
export type SpellingContextMenuRef = {
  enabled: boolean;
  issues: ProofreadIssue[];
  documentKey: string;
  onRefresh: () => void;
};

export const spellingContextMenuRef: SpellingContextMenuRef = {
  enabled: false,
  issues: [],
  documentKey: "scratch",
  onRefresh: () => {},
};

export function syncSpellingContextMenuRef(partial: Partial<SpellingContextMenuRef>): void {
  Object.assign(spellingContextMenuRef, partial);
}
