import type { FormatInspirationExample } from "../../collect/collectFormatInspiration";
import type {
  FormatCategoryAmounts,
  FormatCategoryId,
  FormatCategorySelection,
} from "../formatCategories";
import type { FormatOutputItem } from "../formatOutputTypes";

export type FormatGenerationOutputItem = FormatOutputItem;

export type FormatCategoryGenerationSuccess = {
  status: "success";
  category: FormatCategoryId;
  type: "collection";
  title: string;
  outputs: FormatGenerationOutputItem[];
};

export type FormatCategoryGenerationError = {
  status: "error";
  error: string;
};

export type FormatCategoryGenerationResult =
  | FormatCategoryGenerationSuccess
  | FormatCategoryGenerationError;

export type FormatGenerationOrchestratorResult = Partial<
  Record<FormatCategoryId, FormatCategoryGenerationResult>
>;

export type FormatGenerationRequest = {
  essayTitle: string;
  essayText: string;
  wordCount: number;
  documentId?: string | null;
  selectedFormats: FormatCategorySelection;
  categoryAmounts: FormatCategoryAmounts;
  inspirationExamplesByCategory?: Partial<Record<FormatCategoryId, FormatInspirationExample[]>>;
};
