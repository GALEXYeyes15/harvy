import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { joinPath } from "../workspace/folderNaming";
import { isTauriRuntime } from "../save/saveRuntime";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "bmp", "tif", "tiff"];

export function resolveWorkspaceImageSrc(workspaceRoot: string | null, storedSrc: string): string {
  if (!storedSrc) return "";
  if (/^(https?:|blob:|data:)/i.test(storedSrc)) return storedSrc;
  if (!workspaceRoot || !isTauriRuntime()) return storedSrc;
  const abs = storedSrc.startsWith("/") || /^[A-Za-z]:\\/.test(storedSrc)
    ? storedSrc
    : joinPath(workspaceRoot, storedSrc);
  return convertFileSrc(abs);
}

/** Pick an image from disk and copy it into the workspace `.harvy/assets` folder. */
export async function pickAndImportWorkspaceImage(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return pickBrowserImageBlobUrl();
  }

  const selected = await open({
    multiple: false,
    filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
  });
  if (!selected || Array.isArray(selected)) return null;

  try {
    return await invoke<string>("import_workspace_image", { sourcePath: selected });
  } catch (err) {
    window.alert(err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Browser-only fallback for `npm run dev` without Tauri. */
async function pickBrowserImageBlobUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = IMAGE_EXTENSIONS.map((e) => `.${e}`).join(",");
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve(URL.createObjectURL(file));
    };
    input.click();
  });
}
