import type { EditorView } from "@tiptap/pm/view";
import {
  closeHarvyContextMenu,
  openHarvyContextMenu,
  type HarvyContextMenuSection,
} from "../editor/harvyContextMenu";
import { getSpellingSuggestions } from "./mechanics/spellingChecker";
import {
  addWordToCustomDictionary,
  ignoreSpellingWordForDocument,
} from "./mechanics/spellingDictionary";
import type { SpellingPopoverAnchor } from "./spellingIssueAtClick";
import { spellingContextMenuRef } from "./spellingContextMenuRef";

export function closeSpellingSuggestionPopover(): void {
  closeHarvyContextMenu();
}

export function openSpellingSuggestionPopover(opts: {
  view: EditorView;
  anchor: SpellingPopoverAnchor;
}): void {
  const { view, anchor } = opts;
  const { word, pmFrom, pmTo } = anchor;

  const suggestions = getSpellingSuggestions(word, 3);
  const sections: HarvyContextMenuSection[] = [];

  if (suggestions.length > 0) {
    sections.push(
      suggestions.map((suggestion) => ({
        label: suggestion,
        onClick: () => {
          view.dispatch(view.state.tr.replaceWith(pmFrom, pmTo, view.state.schema.text(suggestion)));
          spellingContextMenuRef.onRefresh();
        },
      })),
    );
  }

  sections.push([
    {
      label: "Ignore",
      onClick: () => {
        ignoreSpellingWordForDocument(word, spellingContextMenuRef.documentKey);
        spellingContextMenuRef.onRefresh();
      },
    },
    {
      label: "Add to Dictionary",
      onClick: () => {
        addWordToCustomDictionary(word);
        spellingContextMenuRef.onRefresh();
      },
    },
  ]);

  openHarvyContextMenu({
    view,
    anchor: { from: pmFrom, to: pmTo },
    sections,
    placement: "below-start",
    className: "harvy-spelling-popover",
  });
}
