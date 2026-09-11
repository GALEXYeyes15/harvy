import { invoke } from "@tauri-apps/api/core";
import { fileNameFromPath, isTauriRuntime } from "../save/saveRuntime";
import { joinPath, splitFileBaseAndExtension } from "./folderNaming";
import { resolveProjectDirectory } from "./documentNotes";

/** Sidecar next to a standalone essay, e.g. `Ambition.md` → `Ambition.md.harvy-criteria`. */
export const DOCUMENT_CRITERIA_SUFFIX = ".harvy-criteria";

export function documentCriteriaSidecarPath(sourcePath: string): string {
  return `${sourcePath}${DOCUMENT_CRITERIA_SUFFIX}`;
}

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

  const projectPath = projectCriteriaPath(sourcePath);
  if (projectPath) {
    try {
      return await invoke<string>("read_workspace_text_file", { path: projectPath });
    } catch {
      // Fall through to sidecar next to the essay.
    }
  }

  try {
    return await invoke<string>("read_workspace_text_file", {
      path: documentCriteriaSidecarPath(sourcePath),
    });
  } catch {
    return "";
  }
}

export async function saveDocumentCriteria(sourcePath: string, criteria: string): Promise<void> {
  if (!isTauriRuntime() || !sourcePath.trim() || !criteria.trim()) return;

  const projectDir = resolveProjectDirectory(sourcePath);
  const projectPath = projectCriteriaPath(sourcePath);
  if (projectDir && projectPath) {
    await invoke("ensure_directory", {
      parentPath: projectDir,
      folderName: "Notes",
    });
    await invoke("write_text_file", {
      path: projectPath,
      contents: criteria,
    });
    return;
  }

  await invoke("write_text_file", {
    path: documentCriteriaSidecarPath(sourcePath),
    contents: criteria,
  });
}

export async function renameDocumentCriteriaSidecar(fromPath: string, toPath: string): Promise<void> {
  if (!isTauriRuntime() || !fromPath.trim() || !toPath.trim()) return;

  const fromProject = projectCriteriaPath(fromPath);
  const toProject = projectCriteriaPath(toPath);
  if (fromProject && toProject) {
    try {
      await invoke("rename_fs_path", { fromPath: fromProject, toPath: toProject });
    } catch {
      // No project criteria file yet.
    }
    return;
  }

  try {
    await invoke("rename_fs_path", {
      fromPath: documentCriteriaSidecarPath(fromPath),
      toPath: documentCriteriaSidecarPath(toPath),
    });
  } catch {
    // No sidecar yet.
  }
}
