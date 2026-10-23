import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "../save/saveRuntime";

let platformPromise: Promise<string> | null = null;

export function tauriClientPlatform(): Promise<string> {
  if (!isTauriRuntime()) return Promise.resolve("web");
  platformPromise ??= invoke<string>("client_platform").catch(() => "other");
  return platformPromise;
}

/** Open the system folder picker. On iPad this is the Files browser. */
export async function pickDirectory(options: {
  title: string;
  defaultPath?: string;
}): Promise<string | null> {
  if ((await tauriClientPlatform()) === "ios") {
    return invoke<string | null>("pick_folder", {
      defaultPath: options.defaultPath,
    });
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: options.title,
    defaultPath: options.defaultPath,
  });
  return typeof selected === "string" ? selected : null;
}
