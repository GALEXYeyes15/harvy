/**
 * Page breaks for the presentation-notes preview.
 * The height matches the PDF export's A4 content box (see pdf_export.rs):
 * 22mm margins, body at 11pt with a 1.42 line factor.
 */

const PAGE_H_MM = 297;
const MARGIN_MM = 22;
const TOP_INSET_MM = 6;
const BOTTOM_GUARD_MM = 8;
const BODY_PT = 11;
const BODY_LINE_FACTOR = 1.42;

const PAGE_GAP_ATTR = "data-page-gap";

export type NotesPageBlockBox = { top: number; bottom: number };

export type NotesPageBreak = { page: number; top: number };

export function presentationNotesPageHeightPx(lineHeightPx: number): number {
  const lineMm = (BODY_PT * BODY_LINE_FACTOR * 25.4) / 72;
  const usableMm = PAGE_H_MM - MARGIN_MM - TOP_INSET_MM - (MARGIN_MM + BOTTOM_GUARD_MM);
  if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) return (usableMm * 96) / 25.4;
  return (usableMm / lineMm) * lineHeightPx;
}

/** Indexes of blocks that should start a new page. Measurements are pre-gap. */
export function pageBreakBlockIndexes(blocks: NotesPageBlockBox[], pageHeight: number): number[] {
  if (!(pageHeight > 0) || blocks.length === 0) return [];
  const indexes: number[] = [];
  let contentStart = blocks[0].top;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const pageEnd = contentStart + pageHeight;
    const startsPast = block.top >= pageEnd - 0.5;
    const crosses = block.bottom > pageEnd + 0.5 && block.top > contentStart + 0.5;
    if (!startsPast && !crosses) continue;
    indexes.push(i);
    contentStart = block.top;
  }
  return indexes;
}

export function collectPresentationNotesBlocks(sheet: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  for (const child of Array.from(sheet.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.matches("ul, ol")) {
      for (const item of Array.from(child.children)) {
        if (item instanceof HTMLLIElement) blocks.push(item);
      }
      continue;
    }
    blocks.push(child);
  }
  return blocks;
}

export function layoutPresentationNotesPages(
  sheet: HTMLElement,
  column: HTMLElement,
): { pageCount: number; breaks: NotesPageBreak[] } {
  for (const marked of Array.from(sheet.querySelectorAll(`[${PAGE_GAP_ATTR}]`))) {
    marked.removeAttribute(PAGE_GAP_ATTR);
  }

  const blocks = collectPresentationNotesBlocks(sheet);
  if (blocks.length === 0) return { pageCount: 0, breaks: [] };

  const lineHeight = Number.parseFloat(getComputedStyle(sheet).lineHeight);
  const pageHeight = presentationNotesPageHeightPx(lineHeight);
  const columnRect = column.getBoundingClientRect();
  const boxes = blocks.map((el) => {
    const rect = el.getBoundingClientRect();
    return { top: rect.top - columnRect.top, bottom: rect.bottom - columnRect.top };
  });
  const indexes = pageBreakBlockIndexes(boxes, pageHeight);
  for (const index of indexes) blocks[index].setAttribute(PAGE_GAP_ATTR, "");

  const placedColumn = column.getBoundingClientRect();
  const breaks = indexes.map((index, order) => {
    const el = blocks[index];
    const rect = el.getBoundingClientRect();
    const gap = Number.parseFloat(getComputedStyle(el).marginTop) || 0;
    return { page: order + 2, top: rect.top - placedColumn.top - gap };
  });
  return { pageCount: breaks.length + 1, breaks };
}
