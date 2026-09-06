const STORAGE_KEY = "harvy:headline-shots";

export type HeadlineShot = {
  id: string;
  createdAt: number;
  /** Absolute file path (Tauri) or data URL (browser). */
  src: string;
};

export function createHeadlineShotId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `headline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parseHeadlineShots(raw: unknown): HeadlineShot[] {
  if (!Array.isArray(raw)) return [];
  const shots: HeadlineShot[] = [];
  for (const value of raw) {
    const shot = parseHeadlineShot(value);
    if (shot) shots.push(shot);
  }
  return shots;
}

function parseHeadlineShot(value: unknown): HeadlineShot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) return null;
  if (typeof record.src !== "string" || !record.src.trim()) return null;
  const createdAt =
    typeof record.createdAt === "number" && Number.isFinite(record.createdAt)
      ? record.createdAt
      : Date.now();
  return {
    id: record.id,
    src: record.src,
    createdAt,
  };
}

export function loadHeadlineShots(): HeadlineShot[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseHeadlineShots(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveHeadlineShots(shots: HeadlineShot[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shots));
}
