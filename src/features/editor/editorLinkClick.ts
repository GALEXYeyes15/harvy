import { openSafeExternalUrl } from "./openExternalUrl";

function isModifierOpenLink(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function findEditorBodyLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;

  const anchor = target.closest("a.harvy-editor-link[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;

  if (anchor.closest(".harvy-image-node__caption--rich")) return null;

  return anchor;
}

/** Cmd/Ctrl + click opens inline editor links without moving the caret. */
export function handleEditorLinkPointerDown(event: MouseEvent): boolean {
  if (!isModifierOpenLink(event)) return false;

  const anchor = findEditorBodyLink(event.target);
  if (!anchor) return false;

  openSafeExternalUrl(anchor.getAttribute("href") ?? anchor.href, event);
  return true;
}

/** Show pointer cursor on links only while Cmd/Ctrl is held. */
export function attachEditorLinkModifierCursor(dom: HTMLElement): () => void {
  const syncModifierClass = (event: KeyboardEvent | MouseEvent) => {
    const on = event.metaKey || event.ctrlKey;
    dom.classList.toggle("ProseMirror-harvy--modifier-open-link", on);
  };

  const clearModifierClass = () => {
    dom.classList.remove("ProseMirror-harvy--modifier-open-link");
  };

  const onKeyDown = (event: KeyboardEvent) => syncModifierClass(event);
  const onKeyUp = (event: KeyboardEvent) => syncModifierClass(event);
  const onMouseMove = (event: MouseEvent) => syncModifierClass(event);
  const onBlur = () => clearModifierClass();

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  dom.addEventListener("mousemove", onMouseMove);
  window.addEventListener("blur", onBlur);

  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    dom.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("blur", onBlur);
    clearModifierClass();
  };
}
