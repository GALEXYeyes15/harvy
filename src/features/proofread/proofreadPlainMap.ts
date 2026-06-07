import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Builds the same string as `doc.textBetween(0, doc.content.size, blockSeparator)` and a
 * parallel UTF-16 index → ProseMirror position map (separator chars use `-1`).
 *
 * Mirrors prosemirror-model `Fragment.textBetween` traversal so model offsets match the
 * proofread API payload.
 */
export function proofreadPlainTextAndPositions(
  doc: PMNode,
  blockSeparator = "\n",
): { text: string; charToPmPos: number[] } {
  const from = 0;
  const to = doc.content.size;
  const chars: string[] = [];
  const charToPmPos: number[] = [];
  let first = true;

  doc.content.nodesBetween(from, to, (node, pos) => {
    const rawText = node.isText ? node.text ?? "" : "";
    const nodeText = node.isText
      ? rawText.slice(Math.max(from, pos) - pos, to - pos)
      : !node.isLeaf
        ? ""
        : node.type.spec.leafText
          ? node.type.spec.leafText(node)
          : "";

    if (node.isBlock && (Boolean(node.isLeaf && nodeText) || node.isTextblock) && blockSeparator) {
      if (first) {
        first = false;
      } else {
        for (const ch of blockSeparator) {
          chars.push(ch);
          charToPmPos.push(-1);
        }
      }
    }

    if (!nodeText) {
      return;
    }

    if (node.isText) {
      const startDoc = Math.max(from, pos);
      for (let i = 0; i < nodeText.length; i++) {
        chars.push(nodeText[i]!);
        charToPmPos.push(startDoc + i);
      }
    } else {
      for (let i = 0; i < nodeText.length; i++) {
        chars.push(nodeText[i]!);
        charToPmPos.push(-1);
      }
    }
  });

  const text = chars.join("");
  if (import.meta.env.DEV) {
    const expected = doc.textBetween(0, doc.content.size, blockSeparator);
    if (text !== expected) {
      // eslint-disable-next-line no-console
      console.warn("[HarvyProofread] plain text map drifted from textBetween", {
        builtLength: text.length,
        expectedLength: expected.length,
      });
    }
  }

  return { text, charToPmPos };
}
