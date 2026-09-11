/** Turn podcast-note body copy into tight Markdown bullet lists, leaving headings intact. */
export function ensurePodcastNotesBullets(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const converted: string[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      converted.push("");
      continue;
    }
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      converted.push(trimmed);
      continue;
    }
    if (/^[-*_]{3,}$/.test(trimmed)) {
      converted.push(trimmed);
      continue;
    }
    const item = trimmed.replace(/^([-*+]|\d+[.)])\s+/, "");
    if (!item) continue;
    converted.push(`- ${item}`);
  }

  const out: string[] = [];
  for (let i = 0; i < converted.length; i++) {
    const line = converted[i]!;
    const prev = out[out.length - 1];
    const next = converted[i + 1];
    if (line === "" && prev?.startsWith("- ") && next?.startsWith("- ")) {
      continue;
    }
    if (line === "" && prev === "") continue;
    out.push(line);
  }

  const joined = out.join("\n").trim();
  return joined ? `${joined}\n` : "";
}
