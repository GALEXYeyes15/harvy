import type { FormatPlatformId } from "../features/format/formatPlatforms";

type FormatPlatformIconProps = {
  platform: FormatPlatformId;
  className?: string;
};

export function FormatPlatformIcon({ platform, className = "h-5 w-5" }: FormatPlatformIconProps) {
  switch (platform) {
    case "x":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M18.244 3H21.5l-7.64 8.74L22.5 21h-6.09l-4.77-5.58L5.8 21H2.54l8.18-9.36L1.5 3h6.24l4.31 5.04L18.244 3zm-2.13 16.2h1.72L7.86 4.74H6.02l10.094 14.46z"
          />
        </svg>
      );
    case "youtube":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M23.5 7.2a3.02 3.02 0 0 0-2.12-2.13C19.54 4.5 12 4.5 12 4.5s-7.54 0-9.38.57A3.02 3.02 0 0 0 .5 7.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 4.8 3.02 3.02 0 0 0 2.12 2.13c1.84.57 9.38.57 9.38.57s7.54 0 9.38-.57a3.02 3.02 0 0 0 2.12-2.13A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-4.8zM9.75 15.5v-7l6 3.5-6 3.5z"
          />
        </svg>
      );
    case "substack":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M4.5 4.5h15v3h-15v-3zm0 5.25h15v3h-15v-3zm0 5.25h15V18h-15v-3z"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm5.75-1.1a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"
          />
        </svg>
      );
    case "tiktok":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M16.5 3h3.1c.2 1.7 1.4 3.3 3 4.1v3.2c-1.8-.05-3.4-.7-4.7-1.7v7.8c0 3.6-2.9 6.5-6.5 6.5S5 20 5 16.4 7.9 9.9 11.5 9.9c.4 0 .8 0 1.2.1v3.4c-.4-.1-.8-.2-1.2-.2-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V3z"
          />
        </svg>
      );
    case "linkedin":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M4.98 3.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5zM3 8.75h3.95V21H3V8.75zm6.53 0H13.4v1.67h.05c.55-1.04 1.9-2.14 3.91-2.14 4.18 0 4.95 2.75 4.95 6.33V21h-3.95v-5.58c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94V21H9.53V8.75z"
          />
        </svg>
      );
    default:
      return null;
  }
}
