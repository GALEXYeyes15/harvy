export type FileMenuHandlers = {
  save: () => void | Promise<void>;
  /** Opens Harvy’s in-app Save As sheet. */
  saveAs: () => void | Promise<void>;
  /** Copy the full document (rich HTML + plain text). */
  copyDocument: () => void | Promise<void>;
  exportPdf: () => void | Promise<void>;
  print: () => void | Promise<void>;
  /** Copy, sync to Notion, and open the publish link. */
  publish: () => void | Promise<void>;
  podcastNotesPdf: () => void | Promise<void>;
  syncWithNotion: () => void | Promise<void>;
  /** Create a new Markdown file in the current browse folder (desktop). */
  newMarkdownFile: () => void | Promise<void>;
};

let handlers: FileMenuHandlers = {
  save: () => {},
  saveAs: () => {},
  copyDocument: () => {},
  exportPdf: () => {},
  print: () => {},
  publish: () => {},
  podcastNotesPdf: () => {},
  syncWithNotion: () => {},
  newMarkdownFile: () => {},
};

export function setFileMenuHandlers(next: FileMenuHandlers): void {
  handlers = next;
}

export function getFileMenuHandlers(): FileMenuHandlers {
  return handlers;
}
