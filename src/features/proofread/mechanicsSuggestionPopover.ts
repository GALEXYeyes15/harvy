import type { EditorView } from "@tiptap/pm/view";
import {
  appendHarvyContextMenuSections,
  closeHarvyContextMenu,
  HARVY_CONTEXT_MENU_DIVIDER_CLASS,
  openHarvyContextMenuPanel,
  type HarvyContextMenuSection,
} from "../editor/harvyContextMenu";
import type { MechanicsSuggestionPopoverAnchor } from "./mechanicsIssueAtClick";
import { ignoreMechanicsSuggestionForDocument } from "./mechanics/mechanicsSuggestionIgnore";
import { spellingContextMenuRef } from "./spellingContextMenuRef";
import type { ProofreadIssue } from "./types";

export function closeMechanicsSuggestionPopover(): void {
  closeHarvyContextMenu();
}

function displayMessage(issue: ProofreadIssue): string {
  return issue.message?.trim() || issue.suggestion?.trim() || "Style suggestion";
}

function replacementText(issue: ProofreadIssue): string | null {
  const replacement = issue.suggestion?.trim();
  if (!replacement) return null;
  if (replacement === displayMessage(issue)) return null;
  return replacement;
}

export function openMechanicsSuggestionPopover(opts: {
  view: EditorView;
  anchor: MechanicsSuggestionPopoverAnchor;
}): void {
  const { view, anchor } = opts;
  const { issue, pmFrom, pmTo } = anchor;
  const message = displayMessage(issue);
  const replacement = replacementText(issue);

  openHarvyContextMenuPanel({
    view,
    anchor: { from: pmFrom, to: pmTo },
    placement: "below-start",
    className: "harvy-mechanics-suggestion-popover",
    populate: (menuEl, runAction) => {
      const header = document.createElement("p");
      header.className = "harvy-context-menu__title";
      header.textContent = "Suggestion";
      menuEl.appendChild(header);

      const note = document.createElement("p");
      note.className = "harvy-context-menu__note harvy-context-menu__note--left";
      note.textContent = message;
      menuEl.appendChild(note);

      const sections: HarvyContextMenuSection[] = [];

      if (replacement) {
        sections.push([
          {
            label: `Replace with “${replacement}”`,
            onClick: () => {
              view.dispatch(
                view.state.tr.replaceWith(pmFrom, pmTo, view.state.schema.text(replacement)),
              );
              spellingContextMenuRef.onRefresh();
            },
          },
        ]);
      }

      sections.push([
        {
          label: "Ignore",
          onClick: () => {
            ignoreMechanicsSuggestionForDocument(issue, spellingContextMenuRef.documentKey);
            spellingContextMenuRef.onRefresh();
          },
        },
      ]);

      if (replacement) {
        const divider = document.createElement("div");
        divider.className = HARVY_CONTEXT_MENU_DIVIDER_CLASS;
        divider.setAttribute("aria-hidden", "true");
        menuEl.appendChild(divider);
      }

      appendHarvyContextMenuSections(menuEl, sections, runAction);
    },
  });
}
