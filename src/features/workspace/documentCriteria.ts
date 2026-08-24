import { invoke } from "@tauri-apps/api/core";
import { fileNameFromPath, isTauriRuntime } from "../save/saveRuntime";
import { joinPath, splitFileBaseAndExtension } from "./folderNaming";
import { resolveProjectDirectory } from "./documentNotes";

/** Criteria filename inside a project folder, e.g. `Untitled.md` → `Untitled Criteria.md`. */
export function projectCriteriaFileName(documentLeafFileName: string): string {
  const { base } = splitFileBaseAndExtension(fileNameFromPath(documentLeafFileName));
  return `${base || "Untitled"} Criteria.md`;
}

export function projectCriteriaPath(documentPath: string): string | null {
  const projectDir = resolveProjectDirectory(documentPath);
  if (!projectDir) return null;
  const leaf = fileNameFromPath(documentPath);
  return joinPath(joinPath(projectDir, "Notes"), projectCriteriaFileName(leaf));
}

export async function loadDocumentCriteria(sourcePath: string): Promise<string> {
  if (!isTauriRuntime() || !sourcePath.trim()) return "";

  const criteriaPath = projectCriteriaPath(sourcePath);
  if (!criteriaPath) return "";

  try {
    return await invoke<string>("read_workspace_text_file", { path: criteriaPath });
  } catch {
    return "";
  }
}

export async function saveDocumentCriteria(sourcePath: string, criteria: string): Promise<void> {
  if (!isTauriRuntime() || !sourcePath.trim() || !criteria.trim()) return;

  const projectDir = resolveProjectDirectory(sourcePath);
  const criteriaPath = projectCriteriaPath(sourcePath);
  if (!projectDir || !criteriaPath) return;

  await invoke("ensure_directory", {
    parentPath: projectDir,
    folderName: "Notes",
  });
  await invoke("write_text_file", {
    path: criteriaPath,
    contents: criteria,
  });
}

export async function renameDocumentCriteriaSidecar(fromPath: string, toPath: string): Promise<void> {
  if (!isTauriRuntime() || !fromPath.trim() || !toPath.trim()) return;

  const fromCriteria = projectCriteriaPath(fromPath);
  const toCriteria = projectCriteriaPath(toPath);
  if (!fromCriteria || !toCriteria) return;

  try {
    await invoke("rename_fs_path", { fromPath: fromCriteria, toPath: toCriteria });
  } catch {
    // No criteria file yet.
  }
}
