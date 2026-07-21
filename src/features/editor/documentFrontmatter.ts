/** Optional Substack-style post title / subtitle stored as YAML frontmatter. */

export type DocumentFrontmatter = {
  postTitle: string;
  subtitle: string;
};

const EMPTY_META: DocumentFrontmatter = { postTitle: "", subtitle: "" };

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function unquoteYamlScalar(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return trimmed;
}

function quoteYamlScalar(value: string): string {
  if (!value) return '""';
  if (/[:#{}[\],&*!|>%@`]/.test(value) || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

/** Split leading YAML frontmatter (`title` / `subtitle`) from Markdown body. */
export function parseDocumentFrontmatter(raw: string): {
  meta: DocumentFrontmatter;
  body: string;
} {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    return { meta: { ...EMPTY_META }, body: raw };
  }

  const yaml = match[1] ?? "";
  let postTitle = "";
  let subtitle = "";
  for (const line of yaml.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = unquoteYamlScalar(line.slice(colon + 1));
    if (key === "title") postTitle = value;
    else if (key === "subtitle") subtitle = value;
  }

  const body = raw.slice(match[0].length).replace(/^\r?\n/, "");
  return { meta: { postTitle, subtitle }, body };
}

/** Prepend title/subtitle frontmatter when either field is non-empty. */
export function serializeDocumentWithFrontmatter(
  body: string,
  meta: DocumentFrontmatter,
): string {
  const postTitle = meta.postTitle.trim();
  const subtitle = meta.subtitle.trim();
  if (!postTitle && !subtitle) return body;

  const lines = ["---"];
  if (postTitle) lines.push(`title: ${quoteYamlScalar(postTitle)}`);
  if (subtitle) lines.push(`subtitle: ${quoteYamlScalar(subtitle)}`);
  lines.push("---", "");
  return `${lines.join("\n")}${body.replace(/^\r?\n/, "")}`;
}
