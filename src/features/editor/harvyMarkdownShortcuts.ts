import {
  Extension,
  InputRule,
  textblockTypeInputRule,
  wrappingInputRule,
} from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";

function isEligibleTextblock(state: EditorState): boolean {
  const { $from } = state.selection;
  if ($from.parent.type.name === "harvyOutlineParagraph") return false;
  if ($from.parent.type.spec.code) return false;
  return true;
}

/** Markdown list/heading shortcuts only at a top-level paragraph (not mid-list). */
function isTopLevelParagraph(state: EditorState): boolean {
  const { $from } = state.selection;
  if ($from.parent.type.name !== "paragraph") return false;
  if (!isEligibleTextblock(state)) return false;
  return $from.node(-1).type.name === "doc";
}

function guardInputRule(rule: InputRule, guard: (state: EditorState) => boolean): InputRule {
  return new InputRule({
    find: rule.find,
    handler: (props) => {
      if (!guard(props.state)) return null;
      return rule.handler(props);
    },
  });
}

/**
 * Notion-style markdown shortcuts at block start (`- `, `* `, `1. `, `# `, etc.).
 * Uses real BulletList / OrderedList / Heading nodes (StarterKit).
 */
export const HarvyMarkdownShortcuts = Extension.create({
  name: "harvyMarkdownShortcuts",
  priority: 1000,

  addInputRules() {
    const { bulletList, orderedList, heading } = this.editor.schema.nodes;
    if (!bulletList || !orderedList || !heading) return [];

    const rules: InputRule[] = [
      guardInputRule(
        wrappingInputRule({
          find: /^\s*([-+*])\s$/,
          type: bulletList,
        }),
        isTopLevelParagraph,
      ),
      guardInputRule(
        wrappingInputRule({
          find: /^(\d+)\.\s$/,
          type: orderedList,
          getAttributes: (match) => ({ start: +match[1]!, delimiter: "period" }),
          joinPredicate: (match, node) =>
            (node.attrs.delimiter ?? "period") === "period" &&
            node.childCount + node.attrs.start === +match[1]!,
        }),
        isTopLevelParagraph,
      ),
      guardInputRule(
        wrappingInputRule({
          find: /^(\d+)\)\s$/,
          type: orderedList,
          getAttributes: (match) => ({ start: +match[1]!, delimiter: "paren" }),
          joinPredicate: (match, node) =>
            node.attrs.delimiter === "paren" && node.childCount + node.attrs.start === +match[1]!,
        }),
        isTopLevelParagraph,
      ),
    ];

    for (const level of [1, 2, 3] as const) {
      rules.push(
        guardInputRule(
          textblockTypeInputRule({
            find: new RegExp(`^(#{${level}})\\s$`),
            type: heading,
            getAttributes: { level },
          }),
          isTopLevelParagraph,
        ),
      );
    }

    return rules;
  },
});
