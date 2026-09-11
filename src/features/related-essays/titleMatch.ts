export function normalizeEssayTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titlesMatch(a: string, b: string, minLength = 8): boolean {
  const left = normalizeEssayTitle(a);
  const right = normalizeEssayTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < minLength || right.length < minLength) return false;
  return left.includes(right) || right.includes(left);
}

export function substackSlugFromTitle(title: string): string {
  return normalizeEssayTitle(title).replace(/\s+/g, "-");
}

export function guessSubstackPostUrl(archiveUrl: string, title: string): string {
  const slug = substackSlugFromTitle(title);
  const raw = archiveUrl.trim();
  if (!slug || !raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${url.origin}/p/${slug}`;
  } catch {
    return "";
  }
}
