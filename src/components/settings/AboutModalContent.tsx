import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { APP_NAME } from "../../lib/constants";

type TributeSlide = {
  id: string;
  content: ReactNode;
};

const TRIBUTE_SLIDES: TributeSlide[] = [
  {
    id: "welcome",
    content: (
      <div className="space-y-4">
        <p className="text-[22px] font-semibold tracking-tight text-ink" style={{ fontFamily: "var(--font-content)" }}>
          {APP_NAME}
        </p>
        <p className="max-w-md text-[14px] leading-relaxed text-muted/90">
          A writing-focused desktop editor designed to make drafting, revision, and readability feel calm and
          intentional.
        </p>
      </div>
    ),
  },
  {
    id: "build",
    content: (
      <div className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/50">Early build</p>
        <p className="max-w-md text-[14px] leading-relaxed text-muted/90">
          Built as a focused writing environment with room to grow into a deeper editorial tool.
        </p>
      </div>
    ),
  },
  {
    id: "dedication",
    content: (
      <div className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/50">Tribute</p>
        <p className="max-w-md text-[14px] leading-relaxed text-muted/90">
          This presentation is a place for dedications, thanks, and the story behind Harvy. Add slides here as the
          tribute grows.
        </p>
      </div>
    ),
  },
];

/**
 * Built-in Tribute presentation (not the Settings › About section).
 */
export function AboutModalContent() {
  const [index, setIndex] = useState(0);
  const total = TRIBUTE_SLIDES.length;
  const slide = TRIBUTE_SLIDES[index]!;

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((current) => Math.min(total - 1, current + 1));
  }, [total]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext]);

  const atStart = index === 0;
  const atEnd = index >= total - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        key={slide.id}
        className="flex min-h-0 flex-1 flex-col justify-center px-2 py-4"
        aria-roledescription="slide"
        aria-label={`Slide ${index + 1} of ${total}`}
      >
        {slide.content}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line/15 pt-3 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={goPrev}
          disabled={atStart}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted/70 transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06]"
          aria-label="Previous slide"
          title="Previous slide"
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        </button>

        <p className="text-[11px] tabular-nums tracking-wide text-muted/55">
          {index + 1} / {total}
        </p>

        <button
          type="button"
          onClick={goNext}
          disabled={atEnd}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted/70 transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06]"
          aria-label="Next slide"
          title="Next slide"
        >
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}
