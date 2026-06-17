import { Check, ChevronDown, Loader2, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { estimateFormatOutputCount } from "../features/format/formatOutputEstimation";
import {
  allFormatCategoriesSelected,
  areAllFormatCategoriesSelected,
  defaultFormatCategorySelection,
  FORMAT_CATEGORIES,
  type FormatCategoryAmounts,
  type FormatCategoryId,
  type FormatCategorySelection,
} from "../features/format/formatCategories";
import { FormatCategoryIcon } from "./FormatCategoryIcon";
import { FormatPlatformAmountSlider } from "./FormatPlatformAmountSlider";

function CategoryCheckToggle({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`harvy-checkbox flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-sm ${
        selected ? "harvy-checkbox--checked" : ""
      }`}
    >
      {selected ? <Check size={14} strokeWidth={2.75} className="text-white" /> : null}
    </span>
  );
}

function CategorySettingsDropdown({
  expanded,
  categoryLabel,
  onToggle,
}: {
  expanded: boolean;
  categoryLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${expanded ? "Collapse" : "Expand"} ${categoryLabel} settings`}
      aria-expanded={expanded}
      onClick={onToggle}
      className="harvy-format-platform-dropdown"
    >
      <ChevronDown
        size={12}
        strokeWidth={2}
        aria-hidden
        className={`shrink-0 transition-transform duration-200 ease-out ${
          expanded ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

type FormatSettingsSidebarPanelProps = {
  essayWordCount: number;
  categorySelection: FormatCategorySelection;
  onCategorySelectionChange: (selection: FormatCategorySelection) => void;
  categoryAmounts: FormatCategoryAmounts;
  onCategoryAmountsChange: (amounts: FormatCategoryAmounts) => void;
  isGeneratingFormats: boolean;
  formatGenerationError: string | null;
  onGenerateFormats: () => void | Promise<void>;
};

function generateFormatsButtonLabel(isGenerating: boolean, formatCount: number): string {
  if (!isGenerating) return "Generate Formats";
  return formatCount === 1 ? "Generating 1 format..." : `Generating ${formatCount} formats...`;
}

export function FormatSettingsSidebarPanel({
  essayWordCount,
  categorySelection,
  onCategorySelectionChange,
  categoryAmounts,
  onCategoryAmountsChange,
  isGeneratingFormats,
  formatGenerationError,
  onGenerateFormats,
}: FormatSettingsSidebarPanelProps) {
  const [expandedCategoryId, setExpandedCategoryId] = useState<FormatCategoryId | null>(null);

  const toggleCategory = (id: FormatCategoryId) => {
    const willEnable = !categorySelection[id];
    onCategorySelectionChange({ ...categorySelection, [id]: willEnable });
    if (!willEnable) {
      setExpandedCategoryId((current) => (current === id ? null : current));
    }
  };

  const toggleCategoryExpanded = (id: FormatCategoryId) => {
    setExpandedCategoryId((current) => (current === id ? null : id));
  };

  const setCategoryAmount = (id: FormatCategoryId, amount: number) => {
    onCategoryAmountsChange({ ...categoryAmounts, [id]: amount });
  };

  const allSelected = areAllFormatCategoriesSelected(categorySelection);

  const selectedFormatCount = useMemo(
    () => FORMAT_CATEGORIES.filter((category) => categorySelection[category.id]).length,
    [categorySelection],
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      onCategorySelectionChange(defaultFormatCategorySelection());
      setExpandedCategoryId(null);
      return;
    }
    onCategorySelectionChange(allFormatCategoriesSelected());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-baseline justify-between gap-4">
        <h2 className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink">
          Format Settings
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mt-8 flex items-center justify-end px-1 pb-1.5">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="harvy-format-select-all"
            aria-pressed={allSelected}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
        <ul className="space-y-0.5 pb-2" role="list">
        {FORMAT_CATEGORIES.map((category) => {
          const selected = categorySelection[category.id];
          const expanded = expandedCategoryId === category.id;
          return (
            <li key={category.id}>
              <div className="group flex w-full items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-white/[0.04]">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => toggleCategory(category.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted/70 dark:text-white/55">
                    <FormatCategoryIcon category={category.id} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-ink/95 dark:text-white/92">
                    {category.label}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  {selected ? (
                    <CategorySettingsDropdown
                      expanded={expanded}
                      categoryLabel={category.label}
                      onToggle={() => toggleCategoryExpanded(category.id)}
                    />
                  ) : null}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    aria-label={`${selected ? "Disable" : "Enable"} ${category.label}`}
                    onClick={() => toggleCategory(category.id)}
                    className="shrink-0 border-0 bg-transparent p-0"
                  >
                    <CategoryCheckToggle selected={selected} />
                  </button>
                </div>
              </div>

              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  selected && expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
                aria-hidden={!(selected && expanded)}
              >
                <div className="overflow-hidden">
                  <div className="px-1 pb-3 pl-9 pr-1 pt-0.5">
                    <p className="mb-1.5 text-[11px] font-medium text-muted/70 dark:text-white/45">
                      Amount
                    </p>
                    <FormatPlatformAmountSlider
                      value={categoryAmounts[category.id]}
                      displayValue={estimateFormatOutputCount(
                        essayWordCount,
                        categoryAmounts[category.id],
                        category.id,
                      )}
                      onChange={(amount) => setCategoryAmount(category.id, amount)}
                    />
                  </div>
                </div>
              </div>
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
          onClick={() => void onGenerateFormats()}
          disabled={isGeneratingFormats}
          aria-busy={isGeneratingFormats}
        >
          {isGeneratingFormats ? (
            <Loader2 size={15} strokeWidth={2.25} aria-hidden className="shrink-0 animate-spin" />
          ) : (
            <Zap size={15} strokeWidth={2.25} aria-hidden className="shrink-0" />
          )}
          {generateFormatsButtonLabel(isGeneratingFormats, selectedFormatCount)}
        </button>
      </div>
    </div>
  );
}
