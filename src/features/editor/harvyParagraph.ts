import Paragraph from "@tiptap/extension-paragraph";

/**
 * Normal paragraphs with optional `harvyRestorableScaffold`: original outline placeholder hint
 * so an empty promoted block can become a writing-mode placeholder again.
 */
export const HarvyParagraph = Paragraph.extend({
  addAttributes() {
    return {
      harvyRestorableScaffold: {
        default: null as string | null,
        parseHTML: (element) => element.getAttribute("data-harvy-restorable-scaffold"),
        renderHTML: (attributes) => {
          if (!attributes.harvyRestorableScaffold) {
            return {};
          }
          return {
            "data-harvy-restorable-scaffold": attributes.harvyRestorableScaffold as string,
          };
        },
      },
    };
  },
});
