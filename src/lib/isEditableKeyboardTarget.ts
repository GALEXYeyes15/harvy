/**
 * True when keyboard events should stay with the focused field instead of
 * triggering app-level shortcuts (save, export, etc.).
 */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const editable = target.closest(
    'input, textarea, select, [contenteditable="true"]',
  );
  return Boolean(editable);
}
