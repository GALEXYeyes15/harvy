export type ViewMenuHandlers = {
  /** Open or focus the expanded Notes window. */
  openNotes: () => void | Promise<void>;
  openWrite: () => void;
  /** No-op when Research is turned off. */
  openResearch: () => void;
  /** Show or hide the Research workspace section (and its menu). */
  setShowResearch: (show: boolean) => void;
  /** Open the Focus mode start / status dialog. */
  openFocusMode: () => void;
  /** End a running Focus session. */
  endFocusMode: () => void;
  /** Bring back the tabs and title after typing hid them. */
  showTabs: () => void;
};

let handlers: ViewMenuHandlers = {
  openNotes: () => {},
  openWrite: () => {},
  openResearch: () => {},
  setShowResearch: () => {},
  openFocusMode: () => {},
  endFocusMode: () => {},
  showTabs: () => {},
};

export function setViewMenuHandlers(next: ViewMenuHandlers): void {
  handlers = next;
}

export function getViewMenuHandlers(): ViewMenuHandlers {
  return handlers;
}
