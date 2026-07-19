import type { Editor } from "@tiptap/core";
import { invoke } from "@tauri-apps/api/core";
import { joinPath } from "../workspace/folderNaming";
import {
  normalizeFsPath,
  toWorkspaceRelativePath,
} from "../workspace/workspacePaths";
import { isTauriRuntime } from "./saveRuntime";

export type EmbeddedImageRef = {
  src: string;
  imageSource?: "unsplash" | null;
  photographerName?: string;
};

/** Slug for Unsplash packaging: "Benjamin Voros" → "benjamin-voros". */
export function slugifyPhotographerForFileName(name: string): string {
  const slug = name
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "photographer";
}

/** e.g. "benjamin-voros-unsplash.jpg" */
export function unsplashPackagedFileName(photographerName: string, ext = "jpg"): string {
  const cleanExt = ext.replace(/^\./, "").toLowerCase() || "jpg";
  return `${slugifyPhotographerForFileName(photographerName)}-unsplash.${cleanExt}`;
}

/** Collect loaded images from the editor (preferred) or Markdown HTML islands. */
export function collectEmbeddedImageSrcs(
  editor: Editor | null,
  fallbackMarkdown: string,
): EmbeddedImageRef[] {
  const seen = new Set<string>();
  const out: EmbeddedImageRef[] = [];

  const push = (ref: EmbeddedImageRef) => {
    const src = ref.src.trim();
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ ...ref, src });
  };

  if (editor) {
    editor.state.doc.descendants((node) => {
      if (node.type.name !== "harvyImage") return;
      if (node.attrs.status !== "loaded") return;
      const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
      push({
        src,
        imageSource: node.attrs.imageSource === "unsplash" ? "unsplash" : null,
        photographerName:
          typeof node.attrs.photographerName === "string" ? node.attrs.photographerName : "",
      });
    });
    if (out.length > 0) return out;
  }

  const figureRe =
    /<figure\b([^>]*)data-harvy-image-status=["']loaded["']([^>]*)>[\s\S]*?<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = figureRe.exec(fallbackMarkdown)) !== null) {
    const attrs = `${match[1] ?? ""}${match[2] ?? ""}`;
    const src = match[3] ?? "";
    const imageSource = /data-image-source=["']unsplash["']/i.test(attrs) ? ("unsplash" as const) : null;
    const photographerName =
      attrs.match(/data-photographer-name=["']([^"']*)["']/i)?.[1]?.trim() ?? "";
    push({ src, imageSource, photographerName });
  }

  // Fallback: any .harvy/assets path mentioned in markdown.
  const assetRe = /(\.harvy\/assets\/[^\s"'<>]+)/gi;
  while ((match = assetRe.exec(fallbackMarkdown)) !== null) {
    push({ src: match[1] ?? "" });
  }

  return out;
}

export function rewriteImageSrcsInMarkdown(
  markdown: string,
  replacements: ReadonlyMap<string, string>,
): string {
  if (replacements.size === 0) return markdown;
  let next = markdown;
  for (const [from, to] of replacements) {
    if (!from || from === to) continue;
    next = next.split(from).join(to);
  }
  return next;
}

export function rewriteImageSrcsInEditor(
  editor: Editor | null,
  replacements: ReadonlyMap<string, string>,
): void {
  if (!editor || replacements.size === 0) return;
  const { state } = editor;
  let tr = state.tr;
  let changed = false;

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "harvyImage") return;
    const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
    const next = replacements.get(src);
    if (!next || next === src) return;
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: next });
    changed = true;
  });

  if (changed) editor.view.dispatch(tr);
}

function extensionFromSrc(src: string, fallback = "jpg"): string {
  if (/^data:/i.test(src)) {
    const mime = src.slice(5, src.indexOf(";")).toLowerCase();
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("gif")) return "gif";
    return "jpg";
  }
  try {
    if (/^https?:\/\//i.test(src)) {
      const url = new URL(src);
      const leaf = url.pathname.split("/").filter(Boolean).pop() ?? "";
      const m = leaf.match(/\.([a-z0-9]{2,5})$/i);
      if (m?.[1]) return m[1].toLowerCase();
    }
  } catch {
    // ignore
  }
  const cleaned = src.split(/[?#]/)[0] ?? src;
  const leaf = cleaned.split(/[/\\]/).pop() ?? "";
  const m = leaf.match(/\.([a-z0-9]{2,5})$/i);
  if (m?.[1]) return m[1].toLowerCase();
  return fallback;
}

export function packagedImageFileName(ref: EmbeddedImageRef, index: number): string {
  const photographer = ref.photographerName?.trim() ?? "";
  if (ref.imageSource === "unsplash" && photographer) {
    return unsplashPackagedFileName(photographer, extensionFromSrc(ref.src, "jpg"));
  }
  return fileNameFromSrc(ref.src, index);
}

function fileNameFromSrc(src: string, index: number): string {
  try {
    if (/^https?:\/\//i.test(src)) {
      const url = new URL(src);
      const leaf = url.pathname.split("/").filter(Boolean).pop() ?? "";
      if (leaf && /\.[a-z0-9]{2,5}$/i.test(leaf)) {
        return leaf.replace(/[^a-zA-Z0-9._-]/g, "_");
      }
    }
  } catch {
    // ignore
  }

  if (/^data:/i.test(src)) {
    return `img_${Date.now()}_${index}.${extensionFromSrc(src)}`;
  }

  const cleaned = src.split(/[?#]/)[0] ?? src;
  const leaf = cleaned.split(/[/\\]/).pop() ?? "";
  if (leaf && /\.[a-z0-9]{2,5}$/i.test(leaf)) {
    return leaf.replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  return `img_${Date.now()}_${index}.png`;
}

function isAlreadyPackagedSrc(
  src: string,
  workspaceRoot: string,
  projectDir: string,
): boolean {
  const imagesDir = normalizeFsPath(joinPath(projectDir, "Images"));
  if (/^(https?:|blob:|data:)/i.test(src)) return false;

  const abs = src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src)
    ? normalizeFsPath(src)
    : normalizeFsPath(joinPath(workspaceRoot, src));

  return abs === imagesDir || abs.startsWith(`${imagesDir}/`);
}

async function materializeImageToDirectory(opts: {
  src: string;
  workspaceRoot: string;
  imagesDir: string;
  fileName: string;
}): Promise<string> {
  const { src, workspaceRoot, imagesDir, fileName } = opts;

  if (/^https?:\/\//i.test(src)) {
    return invoke<string>("download_url_into_directory", {
      url: src,
      destDir: imagesDir,
      fileName,
    });
  }

  if (/^data:/i.test(src)) {
    const comma = src.indexOf(",");
    if (comma < 0) throw new Error("Invalid data URL image.");
    const meta = src.slice(0, comma);
    const payload = src.slice(comma + 1);
    const binary = meta.includes(";base64")
      ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(payload));
    return invoke<string>("write_bytes_into_directory", {
      destDir: imagesDir,
      fileName,
      contents: Array.from(binary),
    });
  }

  if (/^blob:/i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error("Could not read pasted image data.");
    const buffer = new Uint8Array(await res.arrayBuffer());
    return invoke<string>("write_bytes_into_directory", {
      destDir: imagesDir,
      fileName,
      contents: Array.from(buffer),
    });
  }

  const absSource = src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src)
    ? src
    : joinPath(workspaceRoot, src);

  return invoke<string>("copy_file_into_directory", {
    sourcePath: absSource,
    destDir: imagesDir,
    fileName,
  });
}

export type PackageDocumentImagesResult = {
  /** Old src → workspace-relative new src */
  replacements: Map<string, string>;
  /** Filenames written into Images/ (for previews). */
  imageFileNames: string[];
};

/**
 * Copy embedded images into `{projectDir}/Images/` and return src rewrites
 * (workspace-relative paths suitable for Markdown + resolveWorkspaceImageSrc).
 */
export async function packageDocumentImages(opts: {
  workspaceRoot: string;
  projectDir: string;
  sources: EmbeddedImageRef[];
}): Promise<PackageDocumentImagesResult> {
  const { workspaceRoot, projectDir, sources } = opts;
  const replacements = new Map<string, string>();
  const imageFileNames: string[] = [];

  if (!isTauriRuntime() || sources.length === 0) {
    return { replacements, imageFileNames };
  }

  const imagesDir = await invoke<string>("ensure_directory", {
    parentPath: projectDir,
    folderName: "Images",
  });

  let index = 0;
  for (const ref of sources) {
    index += 1;
    const src = ref.src;
    if (isAlreadyPackagedSrc(src, workspaceRoot, projectDir)) {
      const abs = src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src)
        ? src
        : joinPath(workspaceRoot, src);
      const packagedRel = toWorkspaceRelativePath(workspaceRoot, abs) ?? src;
      if (packagedRel !== src) replacements.set(src, packagedRel);
      const leaf = packagedRel.split("/").pop();
      if (leaf) imageFileNames.push(leaf);
      continue;
    }

    try {
      const absDest = await materializeImageToDirectory({
        src,
        workspaceRoot,
        imagesDir,
        fileName: packagedImageFileName(ref, index),
      });
      const rel = toWorkspaceRelativePath(workspaceRoot, absDest);
      if (!rel) {
        throw new Error(`Packaged image is outside the workspace: ${absDest}`);
      }
      replacements.set(src, rel);
      imageFileNames.push(fileNameFromPathLeaf(absDest));
    } catch (err) {
      console.error("[harvy] failed to package image", src, err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  return { replacements, imageFileNames };
}

function fileNameFromPathLeaf(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/** Apply packaging rewrites to markdown + live editor nodes. */
export function applyImageSrcRewrites(
  editor: Editor | null,
  markdown: string,
  replacements: ReadonlyMap<string, string>,
): string {
  rewriteImageSrcsInEditor(editor, replacements);
  return rewriteImageSrcsInMarkdown(markdown, replacements);
}
