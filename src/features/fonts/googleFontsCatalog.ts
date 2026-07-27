/** Fetch and search the public Google Fonts catalog. */

import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";

export type GoogleFontFeeling = {
  id: string;
  weight: number;
};

export type GoogleFontsCatalogEntry = {
  family: string;
  category: string;
  popularity: number;
  trending: number;
  styleCount: number;
  designers: string[];
  stroke: string | null;
  subsets: string[];
  dateAdded: string | null;
  feelings: GoogleFontFeeling[];
};

/** Feeling chips in Google Fonts’ two-column order. */
export const FEELING_FILTERS = [
  "Business",
  "Fancy",
  "Calm",
  "Playful",
  "Cute",
  "Artistic",
  "Vintage",
  "Loud",
  "Sophisticated",
  "Futuristic",
  "Active",
  "Stiff",
  "Innovative",
  "Happy",
  "Childlike",
  "Rugged",
  "Awkward",
  "Excited",
] as const;

export type FeelingFilterId = (typeof FEELING_FILTERS)[number];

/** Preview faces used on Feeling chip labels (loaded on demand). */
export const FEELING_PREVIEW_FONTS: Record<FeelingFilterId, string> = {
  Business: "IBM Plex Sans",
  Fancy: "Great Vibes",
  Calm: "Nunito",
  Playful: "Fredoka",
  Cute: "Pacifico",
  Artistic: "Caveat",
  Vintage: "UnifrakturCook",
  Loud: "Anton",
  Sophisticated: "Playfair Display",
  Futuristic: "Orbitron",
  Active: "Oswald",
  Stiff: "Roboto Condensed",
  Innovative: "Syne",
  Happy: "Pacifico",
  Childlike: "Comic Neue",
  Rugged: "Special Elite",
  Awkward: "Shadows Into Light",
  Excited: "Bungee",
};

type MetadataPayload = {
  familyMetadataList?: Array<{
    family?: string;
    category?: string;
    popularity?: number;
    trending?: number;
    designers?: string[];
    stroke?: string | null;
    subsets?: string[];
    dateAdded?: string;
    fonts?: Record<string, unknown>;
  }>;
};

const METADATA_URL = "https://fonts.google.com/metadata/fonts";
const TAGS_CSV_URL =
  "https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv";

let catalogPromise: Promise<GoogleFontsCatalogEntry[]> | null = null;

function parseFeelingsCsv(raw: string): Map<string, GoogleFontFeeling[]> {
  const map = new Map<string, GoogleFontFeeling[]>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",");
    if (parts.length < 4) continue;
    const family = parts[0]?.trim() ?? "";
    const tag = parts[2]?.trim() ?? "";
    const weight = Number(parts[3]?.trim() ?? 0);
    if (!family || weight <= 0 || !tag.startsWith("/Expressive/")) continue;
    const id = tag.slice("/Expressive/".length);
    if (!id) continue;
    const list = map.get(family) ?? [];
    list.push({ id, weight });
    map.set(family, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  }
  return map;
}

function parseMetadata(
  raw: string,
  feelingsByFamily: Map<string, GoogleFontFeeling[]>,
): GoogleFontsCatalogEntry[] {
  let text = raw.trim();
  if (text.startsWith(")]}'")) {
    text = text.slice(4).trim();
  }
  const payload = JSON.parse(text) as MetadataPayload;
  const list = payload.familyMetadataList ?? [];
  const out: GoogleFontsCatalogEntry[] = [];
  for (const row of list) {
    if (typeof row.family !== "string" || !row.family.trim()) continue;
    const fonts = row.fonts && typeof row.fonts === "object" ? Object.keys(row.fonts) : [];
    const family = row.family.trim();
    out.push({
      family,
      category: typeof row.category === "string" ? row.category : "Sans Serif",
      popularity: typeof row.popularity === "number" ? row.popularity : 9999,
      trending: typeof row.trending === "number" ? row.trending : 9999,
      styleCount: fonts.length > 0 ? fonts.length : 1,
      designers: Array.isArray(row.designers)
        ? row.designers.filter((d): d is string => typeof d === "string")
        : [],
      stroke: typeof row.stroke === "string" && row.stroke.trim() ? row.stroke : null,
      subsets: Array.isArray(row.subsets)
        ? row.subsets.filter((s): s is string => typeof s === "string" && s !== "menu")
        : [],
      dateAdded: typeof row.dateAdded === "string" ? row.dateAdded : null,
      feelings: feelingsByFamily.get(family) ?? [],
    });
  }
  out.sort((a, b) => a.popularity - b.popularity || a.family.localeCompare(b.family));
  return out;
}

async function fetchCatalogViaBrowser(): Promise<GoogleFontsCatalogEntry[]> {
  const [metaRes, tagsRes] = await Promise.all([
    fetch(METADATA_URL),
    fetch(TAGS_CSV_URL),
  ]);
  if (!metaRes.ok) {
    throw new Error(`Could not load Google Fonts (${metaRes.status})`);
  }
  if (!tagsRes.ok) {
    throw new Error(`Could not load Google Fonts tags (${tagsRes.status})`);
  }
  const feelings = parseFeelingsCsv(await tagsRes.text());
  return parseMetadata(await metaRes.text(), feelings);
}

async function fetchCatalogViaTauri(): Promise<GoogleFontsCatalogEntry[]> {
  return invoke<GoogleFontsCatalogEntry[]>("fetch_google_fonts_catalog");
}

export async function loadGoogleFontsCatalog(): Promise<GoogleFontsCatalogEntry[]> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      try {
        if (isTauriRuntime()) {
          return await fetchCatalogViaTauri();
        }
        return await fetchCatalogViaBrowser();
      } catch (error) {
        catalogPromise = null;
        throw error;
      }
    })();
  }
  return catalogPromise;
}

export type GoogleFontsSort = "popularity" | "trending" | "name" | "date";

export type GoogleFontsFilterState = {
  query: string;
  feelings: string[];
  sort: GoogleFontsSort;
};

function feelingWeight(font: GoogleFontsCatalogEntry, feelingId: string): number {
  return font.feelings.find((feeling) => feeling.id === feelingId)?.weight ?? 0;
}

export function filterGoogleFontsCatalog(
  fonts: GoogleFontsCatalogEntry[],
  state: GoogleFontsFilterState,
): GoogleFontsCatalogEntry[] {
  const q = state.query.trim().toLowerCase();
  const feelingSet = state.feelings;

  let out = fonts.filter((font) => {
    if (q && !font.family.toLowerCase().includes(q)) return false;
    if (feelingSet.length > 0) {
      const matches = feelingSet.some((id) => feelingWeight(font, id) > 0);
      if (!matches) return false;
    }
    return true;
  });

  out = [...out];
  if (feelingSet.length === 1) {
    const only = feelingSet[0]!;
    out.sort(
      (a, b) =>
        feelingWeight(b, only) - feelingWeight(a, only) ||
        a.popularity - b.popularity ||
        a.family.localeCompare(b.family),
    );
    return out;
  }

  switch (state.sort) {
    case "name":
      out.sort((a, b) => a.family.localeCompare(b.family));
      break;
    case "trending":
      out.sort((a, b) => a.trending - b.trending || a.family.localeCompare(b.family));
      break;
    case "date":
      out.sort((a, b) => {
        const da = a.dateAdded ?? "";
        const db = b.dateAdded ?? "";
        return db.localeCompare(da) || a.family.localeCompare(b.family);
      });
      break;
    case "popularity":
    default:
      out.sort((a, b) => a.popularity - b.popularity || a.family.localeCompare(b.family));
      break;
  }

  return out;
}
