import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { IMAGE_EXTENSIONS } from "../workspace/tree";
import { isTauriRuntime } from "../save/saveRuntime";
import { createHeadlineShotId, loadHeadlineShots, type HeadlineShot } from "./headlineShots";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/tif": "tif",
};

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = extensionFromName(file.name);
  return Boolean(ext && IMAGE_EXTENSIONS.includes(ext as (typeof IMAGE_EXTENSIONS)[number]));
}

function extensionFromName(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  return name.slice(dot + 1).toLowerCase();
}

function extensionForFile(file: File): string {
  const fromName = extensionFromName(file.name);
  if (fromName && IMAGE_EXTENSIONS.includes(fromName as (typeof IMAGE_EXTENSIONS)[number])) {
    return fromName;
  }
  return MIME_TO_EXT[file.type] ?? "png";
}

export function resolveHeadlineShotSrc(storedSrc: string): string {
  if (!storedSrc) return "";
  if (/^(https?:|blob:|data:)/i.test(storedSrc)) return storedSrc;
  if (!isTauriRuntime()) return storedSrc;
  return convertFileSrc(storedSrc);
}

function shotFromSrc(src: string): HeadlineShot {
  return {
    id: createHeadlineShotId(),
    createdAt: Date.now(),
    src,
  };
}

async function importTauriPath(sourcePath: string): Promise<HeadlineShot> {
  const dest = await invoke<string>("import_headline_screenshot", { sourcePath });
  return shotFromSrc(dest);
}

async function importTauriFile(file: File): Promise<HeadlineShot> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const dest = await invoke<string>("write_headline_screenshot", {
    extension: extensionForFile(file),
    contents: Array.from(buffer),
  });
  return shotFromSrc(dest);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

async function importBrowserFile(file: File): Promise<HeadlineShot> {
  const src = await readFileAsDataUrl(file);
  return shotFromSrc(src);
}

/** Pick one or more images from disk and copy them into headline storage. */
export async function pickAndImportHeadlineScreenshots(): Promise<HeadlineShot[]> {
  if (!isTauriRuntime()) {
    return pickBrowserHeadlineScreenshots();
  }

  const selected = await open({
    multiple: true,
    filters: [{ name: "Images", extensions: [...IMAGE_EXTENSIONS] }],
  });
  if (!selected) return [];
  const paths = Array.isArray(selected) ? selected : [selected];

  const shots: HeadlineShot[] = [];
  for (const path of paths) {
    try {
      shots.push(await importTauriPath(path));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }
  return shots;
}

function pickBrowserHeadlineScreenshots(): Promise<HeadlineShot[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = IMAGE_EXTENSIONS.map((e) => `.${e}`).join(",");
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []).filter(isImageFile);
      void importHeadlineScreenshotFiles(files).then(resolve);
    };
    input.click();
  });
}

/** Import dropped or pasted image files. */
export async function importHeadlineScreenshotFiles(files: File[]): Promise<HeadlineShot[]> {
  const images = files.filter(isImageFile);
  if (images.length === 0) return [];

  const shots: HeadlineShot[] = [];
  for (const file of images) {
    try {
      shots.push(isTauriRuntime() ? await importTauriFile(file) : await importBrowserFile(file));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }
  return shots;
}

export async function deleteHeadlineScreenshotFile(src: string): Promise<void> {
  if (!src || /^(https?:|blob:|data:)/i.test(src) || !isTauriRuntime()) return;
  try {
    await invoke("delete_headline_screenshot", { path: src });
  } catch {
    // Catalog still drops the item; missing files are already gone.
  }
}

export function imageFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter(isImageFile);
}

export function transferLooksLikeFiles(data: DataTransfer | null): boolean {
  if (!data) return false;
  return Array.from(data.types).includes("Files");
}

export function imageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const fromFiles = Array.from(data.files).filter(isImageFile);
  if (fromFiles.length > 0) return fromFiles;

  const fromItems: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) fromItems.push(file);
  }
  return fromItems;
}

export type HeadlineVisionImage = {
  mimeType: string;
  dataBase64: string;
};

const MAX_HEADLINE_VISION_SHOTS = 8;
const MAX_HEADLINE_VISION_EDGE = 1024;
const HEADLINE_VISION_JPEG_QUALITY = 0.72;

export function parseHeadlineDataUrl(src: string): HeadlineVisionImage | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(src.trim());
  if (!match) return null;
  const mimeType = match[1]!.trim().toLowerCase() === "image/jpg" ? "image/jpeg" : match[1]!.trim();
  const dataBase64 = match[2]!.replace(/\s+/g, "");
  if (!dataBase64) return null;
  return { mimeType, dataBase64 };
}

async function loadShotRaw(shot: HeadlineShot): Promise<HeadlineVisionImage | null> {
  if (/^data:/i.test(shot.src)) {
    return parseHeadlineDataUrl(shot.src);
  }

  if (isTauriRuntime() && !/^(https?:|blob:)/i.test(shot.src)) {
    try {
      return await invoke<HeadlineVisionImage>("read_headline_screenshot", { path: shot.src });
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(resolveHeadlineShotSrc(shot.src));
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Could not read screenshot."));
      };
      reader.onerror = () => reject(reader.error ?? new Error("Could not read screenshot."));
      reader.readAsDataURL(blob);
    });
    return parseHeadlineDataUrl(dataUrl);
  } catch {
    return null;
  }
}

function compressHeadlineImageForVision(image: HeadlineVisionImage): Promise<HeadlineVisionImage> {
  if (typeof document === "undefined") return Promise.resolve(image);
  const src = `data:${image.mimeType};base64,${image.dataBase64}`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
      const scale = Math.min(1, MAX_HEADLINE_VISION_EDGE / longest);
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(image);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const jpeg = canvas.toDataURL("image/jpeg", HEADLINE_VISION_JPEG_QUALITY);
      resolve(parseHeadlineDataUrl(jpeg) ?? image);
    };
    img.onerror = () => resolve(image);
    img.src = src;
  });
}

/** Load collected headline screenshots as compact JPEGs for the selected model. */
export async function loadHeadlineShotsForVision(): Promise<HeadlineVisionImage[]> {
  const shots = loadHeadlineShots().slice(0, MAX_HEADLINE_VISION_SHOTS);
  const images: HeadlineVisionImage[] = [];
  for (const shot of shots) {
    const raw = await loadShotRaw(shot);
    if (!raw) continue;
    images.push(await compressHeadlineImageForVision(raw));
  }
  return images;
}
