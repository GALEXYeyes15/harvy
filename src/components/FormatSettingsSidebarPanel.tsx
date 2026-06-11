import { Check, Zap } from "lucide-react";
import { estimateFormatOutputCount } from "../features/format/formatOutputEstimation";
import {
  FORMAT_PLATFORMS,
  type FormatPlatformAmounts,
  type FormatPlatformId,
  type FormatPlatformSelection,
} from "../features/format/formatPlatforms";
import { FormatPlatformAmountSlider } from "./FormatPlatformAmountSlider";
import { FormatPlatformIcon } from "./FormatPlatformIcon";

function PlatformCheckToggle({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-sm transition-colors duration-150 ${
        selected ? "bg-[#2fbf71]" : "bg-white/[0.08]"
      }`}
    >
      {selected ? <Check size={14} strokeWidth={2.75} className="text-white" /> : null}
    </span>
  );
}

type FormatSettingsSidebarPanelProps = {
  essayWordCount: number;
  platformSelection: FormatPlatformSelection;
  onPlatformSelectionChange: (selection: FormatPlatformSelection) => void;
  platformAmounts: FormatPlatformAmounts;
  onPlatformAmountsChange: (amounts: FormatPlatformAmounts) => void;
  isGeneratingFormats: boolean;
  formatGenerationError: string | null;
  onGenerateFormats: () => void;
};

export function FormatSettingsSidebarPanel({
  essayWordCount,
  platformSelection,
  onPlatformSelectionChange,
  platformAmounts,
  onPlatformAmountsChange,
  isGeneratingFormats,
  formatGenerationError,
  onGenerateFormats,
}: FormatSettingsSidebarPanelProps) {
  const togglePlatform = (id: FormatPlatformId) => {
    onPlatformSelectionChange({ ...platformSelection, [id]: !platformSelection[id] });
  };

  const setPlatformAmount = (id: FormatPlatformId, amount: number) => {
    onPlatformAmountsChange({ ...platformAmounts, [id]: amount });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-baseline justify-between gap-4">
        <h2 className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink">
          Format Settings
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="mt-8 space-y-0.5 pb-2" role="list">
        {FORMAT_PLATFORMS.map((platform) => {
          const selected = platformSelection[platform.id];
          return (
            <li key={platform.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-expanded={selected}
                onClick={() => togglePlatform(platform.id)}
                className="group flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center"
                  style={{ color: platform.brandColor }}
                >
                  <FormatPlatformIcon platform={platform.id} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-ink/95 dark:text-white/92">
                  {platform.label}
                </span>
                <PlatformCheckToggle selected={selected} />
              </button>

              {selected ? (
                <div className="px-1 pb-3 pl-9 pr-1 pt-0.5">
                  <p className="mb-1.5 text-[11px] font-medium text-muted/70 dark:text-white/45">
                    Amount
                  </p>
                  <FormatPlatformAmountSlider
                    value={platformAmounts[platform.id]}
                    displayValue={estimateFormatOutputCount(
                      essayWordCount,
                      platformAmounts[platform.id],
                      platform.id,
                    )}
                    onChange={(amount) => setPlatformAmount(platform.id, amount)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
        </ul>
      </div>

      <div className="shrink-0 pt-6">
        {formatGenerationError ? (
          <p className="mb-3 text-[12px] leading-snug text-[#e5484d]/90" role="alert">
            {formatGenerationError}
          </p>
        ) : null}
        <button
          type="button"
          className="harvy-format-generate-button flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-55"
          onClick={onGenerateFormats}
          disabled={isGeneratingFormats}
        >
          <Zap size={15} strokeWidth={2.25} aria-hidden className="shrink-0" />
          {isGeneratingFormats ? "Generating..." : "Generate Formats"}
        </button>
      </div>
    </div>
  );
}
