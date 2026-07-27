import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pipette } from "lucide-react";
import {
  looksLikeHexTyping,
  resolveColorInput,
} from "../../theme/resolveColorInput";

type Hsv = { h: number; s: number; v: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return [
      Number.parseInt(raw[0]! + raw[0]!, 16),
      Number.parseInt(raw[1]! + raw[1]!, 16),
      Number.parseInt(raw[2]! + raw[2]!, 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }
  return null;
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: h * 360, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((n) => clamp(n, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToHsv(hex: string): Hsv {
  const rgb = parseHex(hex);
  if (!rgb) return { h: 180, s: 0.5, v: 0.7 };
  return rgbToHsv(rgb[0], rgb[1], rgb[2]);
}

function hsvToHex(hsv: Hsv): string {
  return toHex(hsvToRgb(hsv.h, hsv.s, hsv.v));
}

/** Only accept a full 6-digit hex while typing (never expand 3-digit mid-edit). */
function normalizeHexInputStrict(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toLowerCase();
  return null;
}

/** Keep the hex field editable: # + up to 6 hex digits. */
function sanitizeHexTyping(value: string): string {
  const upper = value.toUpperCase().replace(/[^0-9A-F#]/g, "");
  const withoutHashes = upper.replace(/#/g, "");
  // Allow a fully cleared field so the user can switch into name mode.
  if (withoutHashes.length === 0) {
    return value.includes("#") ? "#" : "";
  }
  return `#${withoutHashes.slice(0, 6)}`;
}

function sanitizeColorTyping(value: string): string {
  // Hex mode only when the value begins with #. Otherwise treat as a color name.
  if (looksLikeHexTyping(value)) return sanitizeHexTyping(value);
  return value.replace(/[^\w\s'\- ]/g, "").slice(0, 48);
}

function hueCss(h: number): string {
  return toHex(hsvToRgb(h, 1, 1));
}

type CanvaColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
};

/**
 * Canva-style color picker: SV field, hue slider, hex/name field, eyedropper.
 */
export function CanvaColorPicker({ value, onChange, className = "" }: CanvaColorPickerProps) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [hexText, setHexText] = useState(() => hsvToHex(hexToHsv(value)).toUpperCase());
  const hsvRef = useRef(hsv);
  const hexFocusedRef = useRef(false);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"sv" | "hue" | null>(null);

  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  useEffect(() => {
    // Don't clobber the field while the user is typing.
    if (hexFocusedRef.current) return;
    const next = hexToHsv(value);
    setHsv(next);
    hsvRef.current = next;
    setHexText(hsvToHex(next).toUpperCase());
  }, [value]);

  function commit(next: Hsv) {
    hsvRef.current = next;
    setHsv(next);
    const hex = hsvToHex(next);
    if (!hexFocusedRef.current) {
      setHexText(hex.toUpperCase());
    }
    onChange(hex);
  }

  function commitHex(hex: string) {
    const next = hexToHsv(hex);
    hsvRef.current = next;
    setHsv(next);
    setHexText(hex.toUpperCase());
    onChange(hex);
  }

  function pointerToSv(event: { clientX: number; clientY: number }) {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    commit({ ...hsvRef.current, s, v });
  }

  function pointerToHue(event: { clientX: number; clientY: number }) {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = clamp(((event.clientX - rect.left) / rect.width) * 360, 0, 359.99);
    commit({ ...hsvRef.current, h });
  }

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (dragging.current === "sv") pointerToSv(event);
      if (dragging.current === "hue") pointerToHue(event);
    };
    const onUp = () => {
      dragging.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  async function pickFromScreen() {
    const EyeDropperCtor = (
      window as unknown as {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    if (!EyeDropperCtor) return;
    try {
      const result = await new EyeDropperCtor().open();
      const hex = resolveColorInput(result.sRGBHex);
      if (!hex) return;
      commitHex(hex);
    } catch {
      // User cancelled.
    }
  }

  const currentHex = hsvToHex(hsv);
  const eyeDropperSupported = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div
      className={`w-[17.5rem] rounded-xl bg-[#1a1a1a] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10 ${className}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        ref={svRef}
        className="relative h-[9.5rem] w-full cursor-crosshair overflow-hidden rounded-lg"
        style={{
          backgroundColor: hueCss(hsv.h),
          backgroundImage:
            "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = "sv";
          pointerToSv(event);
        }}
        onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (dragging.current !== "sv") return;
          pointerToSv(event);
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: currentHex,
          }}
        />
      </div>

      <div
        ref={hueRef}
        className="relative mt-3 h-3 w-full cursor-ew-resize rounded-full"
        style={{
          background:
            "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
        }}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = "hue";
          pointerToHue(event);
        }}
        onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (dragging.current !== "hue") return;
          pointerToHue(event);
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            backgroundColor: hueCss(hsv.h),
          }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-[#111] px-2.5 py-2 ring-1 ring-white/10">
          <span
            className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
            style={{ backgroundColor: currentHex }}
            aria-hidden
          />
          <input
            type="text"
            value={hexText}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="#HEX or name"
            onFocus={(event) => {
              hexFocusedRef.current = true;
              // Select existing hex so typing a name replaces it immediately.
              event.currentTarget.select();
            }}
            onChange={(event) => {
              const nextText = sanitizeColorTyping(event.target.value);
              setHexText(nextText);
              if (!looksLikeHexTyping(nextText)) return;
              const normalized = normalizeHexInputStrict(nextText);
              if (normalized) commitHex(normalized);
            }}
            onBlur={() => {
              hexFocusedRef.current = false;
              const resolved = resolveColorInput(hexText);
              if (resolved) {
                commitHex(resolved);
              } else {
                setHexText(currentHex.toUpperCase());
              }
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] tracking-wide text-white outline-none placeholder:text-white/35"
            aria-label="Hex color or color name"
          />
        </label>
        <button
          type="button"
          disabled={!eyeDropperSupported}
          onClick={() => void pickFromScreen()}
          title={
            eyeDropperSupported
              ? "Pick color from screen"
              : "Eyedropper isn’t supported in this browser"
          }
          aria-label="Eyedropper"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111] text-white/85 ring-1 ring-white/10 transition-colors hover:bg-[#222] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pipette size={15} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}
