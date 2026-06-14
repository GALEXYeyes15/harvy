import {
  FORMAT_CATEGORY_AMOUNT_MAX,
  FORMAT_CATEGORY_AMOUNT_MIN,
} from "../features/format/formatCategories";

type FormatPlatformAmountSliderProps = {
  /** Internal density slider value (0–100). */
  value: number;
  /** Estimated output count shown in the value box. */
  displayValue: number;
  onChange: (value: number) => void;
};

export function FormatPlatformAmountSlider({
  value,
  displayValue,
  onChange,
}: FormatPlatformAmountSliderProps) {
  const fillPercent =
    ((value - FORMAT_CATEGORY_AMOUNT_MIN) /
      (FORMAT_CATEGORY_AMOUNT_MAX - FORMAT_CATEGORY_AMOUNT_MIN)) *
    100;

  return (
    <div className="flex items-center gap-2.5">
      <input
        type="range"
        min={FORMAT_CATEGORY_AMOUNT_MIN}
        max={FORMAT_CATEGORY_AMOUNT_MAX}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Amount"
        className="harvy-format-amount-slider min-w-0 flex-1"
        style={{ ["--harvy-slider-fill" as string]: `${fillPercent}%` }}
      />
      <span className="flex h-7 min-w-[2.35rem] shrink-0 items-center justify-center rounded-md bg-white/[0.06] px-2 text-[12px] font-medium tabular-nums text-ink/90 dark:text-white/88">
        {displayValue}
      </span>
    </div>
  );
}
