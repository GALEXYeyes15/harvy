/** Resolve free-text color input (hex or color name) to a #rrggbb hex. */

import colorNameList from "./data/colorNames.short.json";

type NamedColor = { name: string; hex: string };

const NAMED_COLORS = colorNameList as NamedColor[];

const NAME_TO_HEX = new Map<string, string>();
for (const entry of NAMED_COLORS) {
  const hex = normalizeHex(entry.hex);
  if (!hex) continue;
  NAME_TO_HEX.set(normalizeNameKey(entry.name), hex);
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const r = withHash[1]!;
    const g = withHash[2]!;
    const b = withHash[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function normalizeNameKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenizeName(value: string): string[] {
  return normalizeNameKey(value).split(" ").filter(Boolean);
}

/** Parse a CSS color string via canvas (named colors, rgb(), etc.). */
function cssColorToHex(input: string): string | null {
  if (typeof document === "undefined") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#000000";
  ctx.fillStyle = trimmed;
  const computed = ctx.fillStyle;
  // Invalid names typically leave fillStyle as black — reject unless input is black.
  if (computed === "#000000" || computed === "#000") {
    const key = normalizeNameKey(trimmed);
    if (key !== "black" && key !== "000" && key !== "000000") return null;
  }

  if (typeof computed === "string" && /^#[0-9a-fA-F]{6}$/i.test(computed)) {
    return computed.toLowerCase();
  }
  if (typeof computed === "string" && computed.startsWith("rgb")) {
    const match = computed.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    const rgb = [match[1], match[2], match[3]].map((n) =>
      Number(n).toString(16).padStart(2, "0"),
    );
    return `#${rgb.join("")}`;
  }
  return null;
}

function lookupNamedHex(phrase: string): string | null {
  const key = normalizeNameKey(phrase);
  if (!key) return null;
  return NAME_TO_HEX.get(key) ?? null;
}

function lookupFuzzyNamedHex(query: string): string | null {
  const tokens = tokenizeName(query);
  if (tokens.length === 0) return null;

  let best: { hex: string; score: number } | null = null;
  for (const entry of NAMED_COLORS) {
    const nameKey = normalizeNameKey(entry.name);
    const nameTokens = nameKey.split(" ");
    const matched = tokens.filter((token) => nameTokens.includes(token)).length;
    if (matched === 0) continue;
    const coverage = matched / tokens.length;
    if (coverage < 0.66 && matched < tokens.length) continue;
    // Prefer covering more query tokens, then fewer extra name tokens, then shorter names.
    const score =
      matched * 100 - Math.abs(nameTokens.length - tokens.length) * 8 - nameKey.length;
    const hex = normalizeHex(entry.hex);
    if (!hex) continue;
    if (!best || score > best.score) best = { hex, score };
  }
  return best?.hex ?? null;
}

/**
 * Resolve typed color input to hex.
 * Accepts #rgb/#rrggbb, CSS named colors, and multi-word names like "Deep forest green".
 */
export function resolveColorInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const asHex = normalizeHex(trimmed);
  if (asHex) return asHex;

  const directCss = cssColorToHex(trimmed) ?? cssColorToHex(trimmed.replace(/\s+/g, ""));
  if (directCss) return directCss;

  const directName = lookupNamedHex(trimmed);
  if (directName) return directName;

  // Drop leading modifiers until a known phrase remains ("Deep forest green" → "forest green").
  const tokens = tokenizeName(trimmed);
  for (let drop = 1; drop < tokens.length; drop++) {
    const phrase = tokens.slice(drop).join(" ");
    const found =
      lookupNamedHex(phrase) ??
      cssColorToHex(phrase) ??
      cssColorToHex(phrase.replace(/\s+/g, ""));
    if (found) return found;
  }

  // Drop trailing words ("ocean blue mist" → "ocean blue").
  for (let keep = tokens.length - 1; keep >= 1; keep--) {
    const phrase = tokens.slice(0, keep).join(" ");
    const found =
      lookupNamedHex(phrase) ??
      cssColorToHex(phrase) ??
      cssColorToHex(phrase.replace(/\s+/g, ""));
    if (found) return found;
  }

  return lookupFuzzyNamedHex(trimmed);
}

/** True when the field is in hex-entry mode (starts with #). */
export function looksLikeHexTyping(value: string): boolean {
  return value.trimStart().startsWith("#");
}
