import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

type DomWithDesc = Node & { pmViewDesc?: unknown };

const TEXTBLOCK_TYPES = new Set(["paragraph", "heading", "harvyOutlineParagraph"]);

/**
 * Grammarly, LanguageTool, and some macOS writing tools inject DOM inside the
 * editor that ProseMirror never adopts. That text paints on the page, but the
 * caret and selection skip it because it has no view desc.
 */
function containsOwned(node: Node): boolean {
  if ((node as DomWithDesc).pmViewDesc) return true;
  for (const child of node.childNodes) {
    if (containsOwned(child)) return true;
  }
  return false;
}

function splitForeignText(block: HTMLElement): { prefix: string; suffix: string } {
  let prefix = "";
  let suffix = "";
  let seenOwnedText = false;

  const take = (chunk: string) => {
    if (!chunk) return;
    if (seenOwnedText) suffix += chunk;
    else prefix += chunk;
  };

  const visit = (parent: Node) => {
    for (const child of parent.childNodes) {
      if ((child as DomWithDesc).pmViewDesc) {
        if (child.nodeType === 3 && (child.nodeValue ?? "").length > 0) seenOwnedText = true;
        if (child.nodeType === 1) visit(child);
        continue;
      }
      if (child.nodeType === 3) {
        take(child.nodeValue ?? "");
        continue;
      }
      if (child.nodeType === 1 && !containsOwned(child)) {
        take(child.textContent ?? "");
        continue;
      }
      if (child.nodeType === 1) visit(child);
    }
  };

  visit(block);
  return { prefix, suffix };
}

function removeForeign(parent: Node): void {
  for (const child of [...parent.childNodes]) {
    if ((child as DomWithDesc).pmViewDesc) {
      if (child.nodeType === 1) removeForeign(child);
      continue;
    }
    if (child.nodeType === 1 && containsOwned(child)) {
      while (child.firstChild) parent.insertBefore(child.firstChild, child);
      child.remove();
      removeForeign(parent);
      return;
    }
    child.remove();
  }
}

type ForeignEdit = { dom: HTMLElement; steps: { pos: number; text: string }[] };

function foreignEdits(view: EditorView): ForeignEdit[] {
  const edits: ForeignEdit[] = [];
  view.state.doc.descendants((node, pos) => {
    if (!TEXTBLOCK_TYPES.has(node.type.name)) return true;
    const edit = editForTextblock(view, node, pos);
    if (edit) edits.push(edit);
    return false;
  });
  return edits;
}

function editForTextblock(view: EditorView, node: PMNode, pos: number): ForeignEdit | null {
  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return null;
  if ((dom.textContent ?? "") === node.textContent) return null;
  const { prefix, suffix } = splitForeignText(dom);
  const steps: { pos: number; text: string }[] = [];
  if (suffix.trim()) steps.push({ pos: pos + node.nodeSize - 1, text: suffix });
  if (prefix.trim()) steps.push({ pos: pos + 1, text: prefix });
  if (steps.length === 0) {
    removeForeign(dom);
    return null;
  }
  return { dom, steps };
}

let recovering = false;

/** Pull stray DOM text back into the document so it can be edited and saved. */
export function recoverForeignDocumentDom(view: EditorView): void {
  if (recovering || view.composing || !view.editable) return;
  const edits = foreignEdits(view);
  if (edits.length === 0) return;

  recovering = true;
  try {
    let tr = view.state.tr;
    const doms: HTMLElement[] = [];
    const steps = edits.flatMap((edit) => {
      doms.push(edit.dom);
      return edit.steps;
    });
    steps.sort((a, b) => b.pos - a.pos);
    for (const step of steps) {
      tr = tr.insertText(step.text, step.pos);
    }
    const observer = (view as EditorView & { domObserver?: { stop: () => void; start: () => void } })
      .domObserver;
    observer?.stop();
    try {
      for (const dom of doms) removeForeign(dom);
      view.dispatch(tr);
      for (const dom of doms) {
        if (view.dom.contains(dom)) removeForeign(dom);
      }
    } finally {
      observer?.start();
    }
  } finally {
    recovering = false;
  }
}

export const ForeignDomRecovery = Extension.create({
  name: "foreignDomRecovery",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view(editorView) {
          let frame = 0;
          const schedule = () => {
            if (frame || recovering) return;
            frame = requestAnimationFrame(() => {
              frame = 0;
              recoverForeignDocumentDom(editorView);
            });
          };
          const observer = new MutationObserver(schedule);
          observer.observe(editorView.dom, { subtree: true, childList: true, characterData: true });
          schedule();
          return {
            update: schedule,
            destroy() {
              observer.disconnect();
              if (frame) cancelAnimationFrame(frame);
            },
          };
        },
      }),
    ];
  },
});
