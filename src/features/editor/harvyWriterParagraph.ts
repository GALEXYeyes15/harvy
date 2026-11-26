import Paragraph from "@tiptap/extension-paragraph";

/**
 * Normal paragraphs with optional `harvyWriterRestorableScaffold`: original outline placeholder hint
 * so an empty promoted block can become a writing-mode placeholder again.
 */
export const HarvyWriterParagraph = Paragraph.extend({
  addAttributes() {
    return {
      harvyWriterRestorableScaffold: {
        default: null as string | null,
        parseHTML: (element) => element.getAttribute("data-harvy-restorable-scaffold"),
        renderHTML: (attributes) => {
          if (!attributes.harvyWriterRestorableScaffold) {
            return {};
          }
          return {
            "data-harvy-restorable-scaffold": attributes.harvyWriterRestorableScaffold as string,
          };
        },
      },
    };
  },
});
