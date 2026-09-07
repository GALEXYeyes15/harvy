export type ViewMenuHandlers = {
  /** Open or focus the expanded Notes window. */
  openNotes: () => void | Promise<void>;
  openWrite: () => void;
  /** No-op when Research is turned off in Settings. */
  openResearch: () => void;
};

let handlers: ViewMenuHandlers = {
  openNotes: () => {},
  openWrite: () => {},
  openResearch: () => {},
};

export function setViewMenuHandlers(next: ViewMenuHandlers): void {
  handlers = next;
}

export function getViewMenuHandlers(): ViewMenuHandlers {
  return handlers;
}
