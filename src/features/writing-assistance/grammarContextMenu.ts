import type { EditorView } from "@tiptap/pm/view";
import type { GrammarIssueKind } from "./grammarRules";

let menuEl: HTMLDivElement | null = null;

function removeMenu(): void {
  menuEl?.remove();
  menuEl = null;
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!menuEl) return;
      if (e.target instanceof Node && menuEl.contains(e.target)) return;
      removeMenu();
    },
    true,
  );
}

export function openGrammarContextMenu(opts: {
  clientX: number;
  clientY: number;
  view: EditorView;
  from: number;
  to: number;
  kind: GrammarIssueKind;
}): void {
  removeMenu();
  const { clientX, clientY, view, from, to, kind } = opts;

  const wrap = document.createElement("div");
  wrap.className =
    "harvy-grammar-menu fixed z-[9999] min-w-[9.5rem] rounded-md border border-line/25 bg-page py-0.5 text-[12px] shadow-md dark:border-white/[0.12] dark:bg-[#252525]";
  wrap.style.left = `${Math.min(clientX, window.innerWidth - 180)}px`;
  wrap.style.top = `${Math.min(clientY + 4, window.innerHeight - 120)}px`;

  const mkBtn = (label: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className =
      "block w-full px-3 py-1.5 text-left text-[12px] text-ink/90 transition hover:bg-ink/[0.06] dark:text-ink/88";
    b.textContent = label;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
      removeMenu();
      view.focus();
    });
    wrap.appendChild(b);
  };

  if (kind === "double-space") {
    mkBtn("Use single space", () => {
      view.dispatch(view.state.tr.replaceWith(from, to, view.state.schema.text(" ")));
    });
  } else if (kind === "trailing-space") {
    mkBtn("Trim whitespace", () => {
      view.dispatch(view.state.tr.delete(from, to));
    });
  } else if (kind === "repeat-word") {
    mkBtn("Remove duplicate", () => {
      view.dispatch(view.state.tr.delete(from, to));
    });
  } else if (kind === "double-punct") {
    mkBtn("Use single mark", () => {
      const raw = view.state.doc.textBetween(from, to, "");
      const next = raw.length ? raw[0] : "";
      if (next) view.dispatch(view.state.tr.replaceWith(from, to, view.state.schema.text(next)));
    });
  } else if (kind === "space-before-punct") {
    mkBtn("Tighten spacing", () => {
      view.dispatch(view.state.tr.delete(from, to));
    });
  } else if (kind === "passive-voice" || kind === "adverb-hint") {
    const note = document.createElement("p");
    note.className =
      "m-0 max-w-[14rem] px-3 py-2 text-left text-[11px] leading-snug text-muted/90";
    note.textContent =
      kind === "passive-voice"
        ? "Passive voice — fine when intentional; consider active verbs for clarity."
        : "Adverb or hedging — often fine; use when it adds precision, not padding.";
    wrap.appendChild(note);
  }

  document.body.appendChild(wrap);
  menuEl = wrap;
}
