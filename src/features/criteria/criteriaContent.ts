export type CriteriaTextLine = {
  kind: "text";
  lineIndex: number;
  text: string;
};

export type CriteriaCheckboxLine = {
  kind: "checkbox";
  lineIndex: number;
  label: string;
  checked: boolean;
};

export type CriteriaLine = CriteriaTextLine | CriteriaCheckboxLine;

const UNCHECKED_CHECKBOX = /^\[\s*\]\s?(.*)$/;
const CHECKED_CHECKBOX = /^\[[xX]\]\s?(.*)$/;

export function parseCriteriaContent(raw: string): CriteriaLine[] {
  if (!raw.trim()) return [];

  const lines: CriteriaLine[] = [];
  for (const [lineIndex, line] of raw.split("\n").entries()) {
    const unchecked = line.match(UNCHECKED_CHECKBOX);
    if (unchecked) {
      lines.push({
        kind: "checkbox",
        lineIndex,
        label: unchecked[1] ?? "",
        checked: false,
      });
      continue;
    }

    const checked = line.match(CHECKED_CHECKBOX);
    if (checked) {
      lines.push({
        kind: "checkbox",
        lineIndex,
        label: checked[1] ?? "",
        checked: true,
      });
      continue;
    }

    lines.push({
      kind: "text",
      lineIndex,
      text: line,
    });
  }

  return lines;
}

export function toggleCriteriaCheckboxAtLine(text: string, lineIndex: number): string {
  const lines = text.split("\n");
  const line = lines[lineIndex];
  if (line === undefined) return text;

  const unchecked = line.match(UNCHECKED_CHECKBOX);
  if (unchecked) {
    lines[lineIndex] = `[x] ${unchecked[1] ?? ""}`;
    return lines.join("\n");
  }

  const checked = line.match(CHECKED_CHECKBOX);
  if (checked) {
    lines[lineIndex] = `[] ${checked[1] ?? ""}`;
    return lines.join("\n");
  }

  return text;
}
