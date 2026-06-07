/**
 * MVP outline model — expand later with saved templates, ids from server, etc.
 */

export type OutlineBlock =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "placeholder"; text: string }
  | { type: "instruction"; text: string };

export type OutlineTemplate = {
  id: string;
  name: string;
  blocks: OutlineBlock[];
};

/** Single built-in template for MVP. */
export const BASIC_ESSAY_OUTLINE: OutlineTemplate = {
  id: "basic-essay",
  name: "Basic Essay Outline",
  blocks: [
    { type: "placeholder", text: "Insert title here" },
    { type: "instruction", text: "Write a title that clearly signals the subject and angle." },
    { type: "heading", text: "Hook", level: 2 },
    { type: "placeholder", text: "Open with a concrete moment, image, or tension point." },
    { type: "instruction", text: "This should make the reader curious and emotionally oriented." },
    { type: "heading", text: "Context", level: 2 },
    { type: "placeholder", text: "Explain what is happening and why it matters." },
    { type: "instruction", text: "Ground the reader before moving into the main idea." },
    { type: "heading", text: "Core Idea", level: 2 },
    { type: "placeholder", text: "State the main point or lesson of the piece." },
    { type: "instruction", text: "Keep this clear and direct. This is the center of the essay." },
    { type: "heading", text: "Development", level: 2 },
    { type: "placeholder", text: "Expand the idea with examples, reflection, or analysis." },
    { type: "instruction", text: "This is where the body of the essay grows." },
    { type: "heading", text: "Application", level: 2 },
    { type: "placeholder", text: "Show how this idea applies in real life." },
    { type: "instruction", text: "Bridge the insight to something practical or observable." },
    { type: "heading", text: "Closing", level: 2 },
    { type: "placeholder", text: "End with a strong final line or image." },
    { type: "instruction", text: "The ending should feel intentional, not abrupt." },
  ],
};
