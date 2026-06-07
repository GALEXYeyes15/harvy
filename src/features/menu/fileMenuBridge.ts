export type FileMenuHandlers = {
  save: () => void | Promise<void>;
  /** Native save panel (file name + destination). */
  saveAsFile: () => void | Promise<void>;
  /** Native folder chooser; saves the document into the chosen folder. */
  saveAsFolder: () => void | Promise<void>;
  exportPdf: () => void | Promise<void>;
  /** Create a new Markdown file in the current browse folder (desktop). */
  newMarkdownFile: () => void | Promise<void>;
};

let handlers: FileMenuHandlers = {
  save: () => {},
  saveAsFile: () => {},
  saveAsFolder: () => {},
  exportPdf: () => {},
  newMarkdownFile: () => {},
};

export function setFileMenuHandlers(next: FileMenuHandlers): void {
  handlers = next;
}

export function getFileMenuHandlers(): FileMenuHandlers {
  return handlers;
}
