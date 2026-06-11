export function appendTextToDocumentNotes(currentNotes: string, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return currentNotes;

  const base = currentNotes.trimEnd();
  return base ? `${base}\n\n${trimmed}` : trimmed;
}
