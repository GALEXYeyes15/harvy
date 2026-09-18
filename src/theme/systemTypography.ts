const STORAGE_KEY = "harvy:system-typography:v1";

export const SYSTEM_TYPOGRAPHY_KEY = STORAGE_KEY;
export const SYSTEM_TYPOGRAPHY_CHANGED_EVENT = "harvy:system-typography-changed";

export const DEFAULT_SYSTEM_BODY_FONT_SIZE_PX = 12;
export const DEFAULT_SYSTEM_LINE_EXPANSION_PX = 0;

export const SYSTEM_BODY_FONT_SIZE_LIMITS = {
  min: 10,
  max: 18,
  step: 1,
} as const;

export const SYSTEM_LINE_EXPANSION_LIMITS = {
  min: 0,
  max: 640,
  step: 20,
} as const;

export type SystemTypography = {
  /** App chrome body text size in CSS pixels (sidebars, settings, menus). */
  bodyFontSizePx: number;
  /** Extra Write column width in CSS pixels, on top of the 820px base. */
  lineExpansionPx: number;
};

export const DEFAULT_SYSTEM_TYPOGRAPHY: SystemTypography = {
  bodyFontSizePx: DEFAULT_SYSTEM_BODY_FONT_SIZE_PX,
  lineExpansionPx: DEFAULT_SYSTEM_LINE_EXPANSION_PX,
};

export function clampSystemBodyFontSize(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SYSTEM_BODY_FONT_SIZE_PX;
  const clamped = Math.min(
    SYSTEM_BODY_FONT_SIZE_LIMITS.max,
    Math.max(SYSTEM_BODY_FONT_SIZE_LIMITS.min, n),
  );
  return Math.round(clamped / SYSTEM_BODY_FONT_SIZE_LIMITS.step) * SYSTEM_BODY_FONT_SIZE_LIMITS.step;
}

export function clampSystemLineExpansion(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SYSTEM_LINE_EXPANSION_PX;
  const clamped = Math.min(
    SYSTEM_LINE_EXPANSION_LIMITS.max,
    Math.max(SYSTEM_LINE_EXPANSION_LIMITS.min, n),
  );
  return Math.round(clamped / SYSTEM_LINE_EXPANSION_LIMITS.step) * SYSTEM_LINE_EXPANSION_LIMITS.step;
}

export function readSystemTypography(): SystemTypography {
  if (typeof window === "undefined") return { ...DEFAULT_SYSTEM_TYPOGRAPHY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SYSTEM_TYPOGRAPHY };
    const parsed = JSON.parse(raw) as Partial<SystemTypography>;
    return {
      bodyFontSizePx: clampSystemBodyFontSize(
        parsed.bodyFontSizePx ?? DEFAULT_SYSTEM_BODY_FONT_SIZE_PX,
      ),
      lineExpansionPx: clampSystemLineExpansion(
        parsed.lineExpansionPx ?? DEFAULT_SYSTEM_LINE_EXPANSION_PX,
      ),
    };
  } catch {
    return { ...DEFAULT_SYSTEM_TYPOGRAPHY };
  }
}

export function writeSystemTypography(
  partial: Partial<SystemTypography>,
): SystemTypography {
  const current = readSystemTypography();
  const next: SystemTypography = {
    bodyFontSizePx: clampSystemBodyFontSize(
      partial.bodyFontSizePx ?? current.bodyFontSizePx,
    ),
    lineExpansionPx: clampSystemLineExpansion(
      partial.lineExpansionPx ?? current.lineExpansionPx,
    ),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYSTEM_TYPOGRAPHY_CHANGED_EVENT));
  }
  return next;
}

/** Paint chrome type size. Editor body still uses `--editor-font-size`. */
export function applySystemTypography(prefs: SystemTypography = readSystemTypography()) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--ui-font-size", `${prefs.bodyFontSizePx}px`);
}
