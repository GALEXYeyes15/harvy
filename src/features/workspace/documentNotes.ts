import { invoke } from "@tauri-apps/api/core";
import { fileNameFromPath, isTauriRuntime } from "../save/saveRuntime";
import { joinPath, parentDirectory, splitFileBaseAndExtension } from "./folderNaming";

/** @deprecated Legacy sidecar suffix — only read for migration. */
export const DOCUMENT_NOTES_SUFFIX = ".harvy-notes";

export function documentNotesSidecarPath(sourcePath: string): string {
  return `${sourcePath}${DOCUMENT_NOTES_SUFFIX}`;
}

/** Notes filename inside a project folder, e.g. `Untitled.md` → `Untitled Note.md`. */
export function projectNotesFileName(documentLeafFileName: string): string {
  const { base } = splitFileBaseAndExtension(fileNameFromPath(documentLeafFileName));
  return `${base || "Untitled"} Note.md`;
}

/**
 * Project folder for documents saved as `{parent}/{basename}/{basename}.md`.
 * Returns null for standalone file saves.
 */
export function resolveProjectDirectory(documentPath: string): string | null {
  const parent = parentDirectory(documentPath);
  const leaf = fileNameFromPath(documentPath);
  const { base } = splitFileBaseAndExtension(leaf);
  if (!base) return null;
  if (fileNameFromPath(parent) !== base) return null;
  return parent;
}

export function projectNotesPath(documentPath: string): string | null {
  const projectDir = resolveProjectDirectory(documentPath);
  if (!projectDir) return null;
  const leaf = fileNameFromPath(documentPath);
  return joinPath(joinPath(projectDir, "Notes"), projectNotesFileName(leaf));
}

export async function loadDocumentNotes(sourcePath: string): Promise<string> {
  if (!isTauriRuntime() || !sourcePath.trim()) return "";

  const notesInProject = projectNotesPath(sourcePath);
  if (notesInProject) {
    try {
      return await invoke<string>("read_workspace_text_file", { path: notesInProject });
    } catch {
      // Fall through to legacy sidecar.
    }
  }

  try {
    return await invoke<string>("read_workspace_text_file", {
      path: documentNotesSidecarPath(sourcePath),
    });
  } catch {
    return "";
  }
}

export async function saveDocumentNotes(sourcePath: string, notes: string): Promise<void> {
  if (!isTauriRuntime() || !sourcePath.trim() || !notes.trim()) return;

  const projectDir = resolveProjectDirectory(sourcePath);
  const notesPath = projectNotesPath(sourcePath);
  if (!projectDir || !notesPath) return;

  await invoke("ensure_directory", {
    parentPath: projectDir,
    folderName: "Notes",
  });
  await invoke("write_text_file", {
    path: notesPath,
    contents: notes,
  });
}

export async function renameDocumentNotesSidecar(fromPath: string, toPath: string): Promise<void> {
  if (!isTauriRuntime() || !fromPath.trim() || !toPath.trim()) return;

  const fromProjectNotes = projectNotesPath(fromPath);
  const toProjectNotes = projectNotesPath(toPath);
  if (fromProjectNotes && toProjectNotes) {
    try {
      await invoke("rename_fs_path", { fromPath: fromProjectNotes, toPath: toProjectNotes });
    } catch {
      // No notes file yet.
    }
    return;
  }

  try {
    await invoke("rename_fs_path", {
      fromPath: documentNotesSidecarPath(fromPath),
      toPath: documentNotesSidecarPath(toPath),
    });
  } catch {
    // No legacy sidecar yet.
  }
}
