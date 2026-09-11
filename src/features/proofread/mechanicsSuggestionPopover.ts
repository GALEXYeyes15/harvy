import type { EditorView } from "@tiptap/pm/view";
import { setLinkOnView } from "../editor/editorFormatActions";
import { hrefForEditorLink } from "../editor/linkUrlValidation";
import {
  appendHarvyContextMenuSections,
  closeHarvyContextMenu,
  HARVY_CONTEXT_MENU_DIVIDER_CLASS,
  openHarvyContextMenuAt,
  type HarvyContextMenuSection,
} from "../editor/harvyContextMenu";
import { relatedEssayLinkingRef } from "../related-essays/relatedEssayLinkingRef";
import type { MechanicsSuggestionPopoverAnchor } from "./mechanicsIssueAtClick";
import { ignoreMechanicsSuggestionForDocument } from "./mechanics/mechanicsSuggestionIgnore";
import {
  dispatchProofreadDecorations,
  mechanicsUnderlineLayerKey,
} from "./mechanicsUnderlineLayer";
import { spellingContextMenuRef } from "./spellingContextMenuRef";
import type { ProofreadIssue } from "./types";
import { aiCheckPopoverPrefsRef } from "../aiCheck/aiCheckPopoverPrefs";

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

function embedRelatedEssayLink(view: EditorView, from: number, to: number, href: string): boolean {
  if (!setLinkOnView(view, from, to, href)) return false;
  const current = mechanicsUnderlineLayerKey.getState(view.state)?.ranges ?? [];
  dispatchProofreadDecorations(
    view,
    current.filter(
      (range) => range.type !== "related" || range.from >= to || range.to <= from,
    ),
  );
  return true;
}

function openRelatedEssayPopover(opts: {
  view: EditorView;
  anchor: MechanicsSuggestionPopoverAnchor;
}): void {
  const { view, anchor } = opts;
  const { issue, pmFrom, pmTo } = anchor;
  const title = issue.relatedTitle?.trim() || "Related essay";
  const message = displayMessage(issue);
  const path = issue.relatedPath?.trim() ?? "";
  const url =
    issue.relatedUrl?.trim() || relatedEssayLinkingRef.urlForPath(path);

  openHarvyContextMenuAt({
    view,
    anchor: { from: pmFrom, to: pmTo },
    placement: "below-start",
    alignToUnderlineMount: true,
    className: "harvy-mechanics-suggestion-popover",
    populate: (menuEl, runAction) => {
      const header = document.createElement("p");
      header.className = "harvy-context-menu__title harvy-context-menu__title--ai";
      header.textContent = title;
      menuEl.appendChild(header);

      const note = document.createElement("p");
      note.className = "harvy-context-menu__note harvy-context-menu__note--left";
      note.textContent = message;
      menuEl.appendChild(note);

      const divider = document.createElement("div");
      divider.className = HARVY_CONTEXT_MENU_DIVIDER_CLASS;
      divider.setAttribute("aria-hidden", "true");
      menuEl.appendChild(divider);

      appendHarvyContextMenuSections(
        menuEl,
        [
          [
            {
              label: "Link Essay",
              disabled: !path && !title && !url,
              onClick: () => {
                void (async () => {
                  const href =
                    hrefForEditorLink(url) ||
                    hrefForEditorLink(
                      await relatedEssayLinkingRef.resolveUrl(path, title),
                    );
                  if (!href) {
                    window.alert(
                      "Add your Substack URL in Settings → Export so Harvy can link this essay.",
                    );
                    return;
                  }
                  if (!embedRelatedEssayLink(view, pmFrom, pmTo, href)) return;
                  relatedEssayLinkingRef.onLinkEssay({
                    path,
                    url: href,
                    start: issue.start,
                    end: issue.end,
                  });
                  spellingContextMenuRef.onRefresh();
                })();
              },
            },
          ],
        ],
        runAction,
      );
    },
  });
}

export function openMechanicsSuggestionPopover(opts: {
  view: EditorView;
  anchor: MechanicsSuggestionPopoverAnchor;
}): void {
  const { view, anchor } = opts;
  if (anchor.issue.type === "related") {
    openRelatedEssayPopover(opts);
    return;
  }

  const { issue, pmFrom, pmTo } = anchor;
  const message = displayMessage(issue);
  const replacement = replacementText(issue);

  openHarvyContextMenuAt({
    view,
    anchor: { from: pmFrom, to: pmTo },
    placement: "below-start",
    alignToUnderlineMount: true,
    className: "harvy-mechanics-suggestion-popover",
    populate: (menuEl, runAction) => {
      const header = document.createElement("p");
      header.className =
        issue.type === "ai"
          ? "harvy-context-menu__title harvy-context-menu__title--ai"
          : "harvy-context-menu__title";
      header.textContent = issue.type === "ai" ? "AI check" : "Suggestion";
      menuEl.appendChild(header);

      const note = document.createElement("p");
      note.className = "harvy-context-menu__note harvy-context-menu__note--left";
      note.textContent = message;
      menuEl.appendChild(note);

      const sections: HarvyContextMenuSection[] = [];

      const showReplace =
        issue.type !== "ai" || aiCheckPopoverPrefsRef.showReplaceSuggestions;

      if (replacement && showReplace) {
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

      if (replacement && showReplace) {
        const divider = document.createElement("div");
        divider.className = HARVY_CONTEXT_MENU_DIVIDER_CLASS;
        divider.setAttribute("aria-hidden", "true");
        menuEl.appendChild(divider);
      }

      appendHarvyContextMenuSections(menuEl, sections, runAction);
    },
  });
}
