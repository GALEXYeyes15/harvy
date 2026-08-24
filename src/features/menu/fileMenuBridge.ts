export type FileMenuHandlers = {
  save: () => void | Promise<void>;
  /** Opens Harvy’s in-app Save As sheet. */
  saveAs: () => void | Promise<void>;
  exportPdf: () => void | Promise<void>;
  /** Create a new Markdown file in the current browse folder (desktop). */
  newMarkdownFile: () => void | Promise<void>;
};

let handlers: FileMenuHandlers = {
  save: () => {},
  saveAs: () => {},
  exportPdf: () => {},
  newMarkdownFile: () => {},
};

export function setFileMenuHandlers(next: FileMenuHandlers): void {
  handlers = next;
}

export function getFileMenuHandlers(): FileMenuHandlers {
  return handlers;
}
