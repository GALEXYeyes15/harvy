/** Optional Substack-style post title / subtitle stored as YAML frontmatter. */

export type DocumentFrontmatter = {
  postTitle: string;
  subtitle: string;
  notionParentPageId: string;
  notionEssayPageId: string;
  notionRenameParent: boolean;
};

const EMPTY_META: DocumentFrontmatter = {
  postTitle: "",
  subtitle: "",
  notionParentPageId: "",
  notionEssayPageId: "",
  notionRenameParent: false,
};

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

function parseYamlBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

/** Split leading YAML frontmatter (`title` / `subtitle` / Notion ids) from Markdown body. */
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
  let notionParentPageId = "";
  let notionEssayPageId = "";
  let notionRenameParent = false;
  for (const line of yaml.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = unquoteYamlScalar(line.slice(colon + 1));
    if (key === "title") postTitle = value;
    else if (key === "subtitle") subtitle = value;
    else if (key === "notion_page" || key === "notion-page") notionParentPageId = value.trim();
    else if (key === "notion_essay" || key === "notion-essay") notionEssayPageId = value.trim();
    else if (key === "notion_created" || key === "notion-created") {
      notionRenameParent = parseYamlBoolean(value);
    }
  }

  const body = raw.slice(match[0].length).replace(/^\r?\n/, "");
  return {
    meta: { postTitle, subtitle, notionParentPageId, notionEssayPageId, notionRenameParent },
    body,
  };
}

/** Prepend title/subtitle/Notion frontmatter when any field is non-empty. */
export function serializeDocumentWithFrontmatter(
  body: string,
  meta: Partial<DocumentFrontmatter>,
): string {
  const postTitle = (meta.postTitle ?? "").trim();
  const subtitle = (meta.subtitle ?? "").trim();
  const notionParentPageId = (meta.notionParentPageId ?? "").trim();
  const notionEssayPageId = (meta.notionEssayPageId ?? "").trim();
  const notionRenameParent = Boolean(meta.notionRenameParent);
  if (!postTitle && !subtitle && !notionParentPageId && !notionEssayPageId) return body;

  const lines = ["---"];
  if (postTitle) lines.push(`title: ${quoteYamlScalar(postTitle)}`);
  if (subtitle) lines.push(`subtitle: ${quoteYamlScalar(subtitle)}`);
  if (notionParentPageId) lines.push(`notion_page: ${quoteYamlScalar(notionParentPageId)}`);
  if (notionEssayPageId) lines.push(`notion_essay: ${quoteYamlScalar(notionEssayPageId)}`);
  if (notionRenameParent) lines.push("notion_created: true");
  lines.push("---", "");
  return `${lines.join("\n")}${body.replace(/^\r?\n/, "")}`;
}
