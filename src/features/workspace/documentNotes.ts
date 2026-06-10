import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";

export const DOCUMENT_NOTES_SUFFIX = ".harvy-notes";

export function documentNotesSidecarPath(sourcePath: string): string {
  return `${sourcePath}${DOCUMENT_NOTES_SUFFIX}`;
}

export async function loadDocumentNotes(sourcePath: string): Promise<string> {
  if (!isTauriRuntime() || !sourcePath.trim()) return "";
  try {
    return await invoke<string>("read_workspace_text_file", {
      path: documentNotesSidecarPath(sourcePath),
    });
  } catch {
    return "";
  }
}

export async function saveDocumentNotes(sourcePath: string, notes: string): Promise<void> {
  if (!isTauriRuntime() || !sourcePath.trim()) return;
  await invoke("write_text_file", {
    path: documentNotesSidecarPath(sourcePath),
    contents: notes,
  });
}

export async function renameDocumentNotesSidecar(fromPath: string, toPath: string): Promise<void> {
  if (!isTauriRuntime() || !fromPath.trim() || !toPath.trim()) return;
  try {
    await invoke("rename_fs_path", {
      fromPath: documentNotesSidecarPath(fromPath),
      toPath: documentNotesSidecarPath(toPath),
    });
  } catch {
    // No sidecar yet — nothing to rename.
  }
}
