import { APP_NAME } from "../../lib/constants";

/**
 * Standalone About copy for the About utility modal (not the Settings › About section).
 */
export function AboutModalContent() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] font-semibold tracking-tight text-ink">{APP_NAME}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted/90">
          Harvy is a writing-focused desktop editor designed to make drafting, revision, and readability feel calm and
          intentional.
        </p>
      </div>
      <div className="rounded-lg bg-mist/90 px-3.5 py-3 dark:bg-ink/[0.04]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/50">Version</p>
        <p className="mt-1 text-[13px] font-medium tracking-tight text-ink">early build</p>
      </div>
      <p className="text-[12px] leading-relaxed text-muted/90">
        Built as a focused writing environment with room to grow into a deeper editorial tool.
      </p>
      <p className="text-[11px] leading-relaxed text-muted/65">Links and resources can live here later.</p>
    </div>
  );
}
