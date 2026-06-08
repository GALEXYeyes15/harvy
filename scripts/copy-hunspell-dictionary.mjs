import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "node_modules", "dictionary-en-us");
const targetDir = join(root, "public", "hunspell");

await mkdir(targetDir, { recursive: true });
await copyFile(join(sourceDir, "index.aff"), join(targetDir, "en_US.aff"));
await copyFile(join(sourceDir, "index.dic"), join(targetDir, "en_US.dic"));
