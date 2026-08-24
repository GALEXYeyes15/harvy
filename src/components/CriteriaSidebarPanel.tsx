import { Check } from "lucide-react";
import { useMemo } from "react";
import {
  parseCriteriaContent,
  toggleCriteriaCheckboxAtLine,
} from "../features/criteria/criteriaContent";

type CriteriaSidebarPanelProps = {
  criteria: string;
  onCriteriaChange: (value: string) => void;
};

export function CriteriaSidebarPanel({ criteria, onCriteriaChange }: CriteriaSidebarPanelProps) {
  const lines = useMemo(() => parseCriteriaContent(criteria), [criteria]);

  const handleToggleCheckbox = (lineIndex: number) => {
    onCriteriaChange(toggleCriteriaCheckboxAtLine(criteria, lineIndex));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-[1.45rem] font-semibold leading-none tracking-[-0.02em] text-ink">
          Criteria
        </h2>
      </header>
      <div className="my-6 h-px w-full shrink-0 bg-line/35" aria-hidden />

      {lines.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted/70">
          Add criteria in Settings → Sidebars → Criteria.
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {lines.map((line) => {
            if (line.kind === "text") {
              if (!line.text.trim()) {
                return <div key={line.lineIndex} className="h-2" aria-hidden />;
              }
              return (
                <p
                  key={line.lineIndex}
                  className="text-[13px] leading-relaxed text-ink/90"
                >
                  {line.text}
                </p>
              );
            }

            return (
              <button
                key={line.lineIndex}
                type="button"
                role="checkbox"
                aria-checked={line.checked}
                onClick={() => handleToggleCheckbox(line.lineIndex)}
                className="group flex w-full items-start gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]"
              >
                <span
                  className={`harvy-checkbox mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-sm ${
                    line.checked
                      ? "harvy-checkbox--checked"
                      : "border border-line/45 bg-transparent dark:border-white/22"
                  }`}
                  aria-hidden
                >
                  {line.checked ? (
                    <Check size={14} strokeWidth={2.75} className="text-white" />
                  ) : null}
                </span>
                <span className="text-[13px] leading-snug text-ink">
                  {line.label || "Untitled criterion"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
