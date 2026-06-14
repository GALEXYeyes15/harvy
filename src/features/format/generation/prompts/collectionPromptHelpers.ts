import type { FormatInspirationExample } from "../../../collect/collectFormatInspiration";
import type { FormatCategoryId } from "../../formatCategories";

const INSPIRATION_PREAMBLE =
  "Below are examples the user has saved in Harvy Collect. Use these as inspiration for structure and style only. Do not copy them. Do not reuse their specific claims unless those claims also appear in the essay.";

export function buildInspirationRules(hasInspirationExamples: boolean): string {
  if (!hasInspirationExamples) return "";
  return `
- Use the Harvy Collect examples to infer style, rhythm, structure, pacing, and framing.
- Do not directly copy or lightly paraphrase the Collect examples.
- Do not introduce ideas that appear only in the Collect examples and not in the essay.`;
}

export function buildCollectionJsonShape(
  category: FormatCategoryId,
  itemIdPrefix: string,
  titleExample: string,
): string {
  return `{
  "category": "${category}",
  "type": "collection",
  "title": "${titleExample}",
  "items": [
    {
      "id": "${itemIdPrefix}-1",
      "title": null,
      "content": "Output content here...",
      "status": "draft",
      "favorite": false
    }
  ]
}`;
}

export function buildUserPromptWithInspiration(
  essayText: string,
  inspirationExamples: FormatInspirationExample[],
): string {
  const trimmedEssay = essayText.trim();
  if (inspirationExamples.length === 0) {
    return `Essay:\n\n${trimmedEssay}`;
  }

  const examplesBlock = inspirationExamples
    .filter((example) => example.preview.trim().length > 0)
    .map((example, index) => `${index + 1}. [${example.type}] ${example.preview.trim()}`)
    .join("\n");

  return `Essay:\n\n${trimmedEssay}\n\n${INSPIRATION_PREAMBLE}\n\n${examplesBlock}`;
}

export function buildCollectionSystemPrompt(opts: {
  category: FormatCategoryId;
  roleDescription: string;
  count: number;
  itemIdPrefix: string;
  titleExample: string;
  outputRules: string;
  hasInspirationExamples: boolean;
}): string {
  const jsonShape = buildCollectionJsonShape(
    opts.category,
    opts.itemIdPrefix,
    opts.titleExample,
  );

  return `${opts.roleDescription}

Return ONLY valid JSON in this exact shape:
${jsonShape}

Rules:
- Generate exactly ${opts.count} outputs.
- Base outputs ONLY on the provided essay. Do not invent unrelated ideas.
- Preserve the author's voice from the essay.
- Use ids "${opts.itemIdPrefix}-1" through "${opts.itemIdPrefix}-${opts.count}".
- Set title to null and status to "draft" with favorite false for every item.${buildInspirationRules(opts.hasInspirationExamples)}
${opts.outputRules}
- Return JSON only. No markdown fences or explanations.`;
}
