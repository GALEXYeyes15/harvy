import type { EditorStats } from "./stats";

/** Plain-text snapshot of the readability sidebar (for clipboard / debugging). */
export function buildToolsSidebarPlainText(stats: EditorStats): string {
  const lines: string[] = [
    "READABILITY",
    stats.gradeLabel,
    "",
    stats.readabilitySummary,
    "",
    `Flesch Reading Ease: ${stats.fleschReadingEase.toFixed(1)}`,
    `Flesch-Kincaid Grade: ${stats.fleschKincaidGradeLevel.toFixed(1)}`,
    "",
    `Reading time (300 words/min): ${stats.readingTimeAt300Wpm}`,
    `Word count: ${stats.words}`,
    "",
    `Adverbs / hedging: ${stats.adverbs}`,
    `Passive voice: ${stats.passiveVoiceSentences}`,
    `Complex sentences: ${stats.complexSentences}`,
    "",
    "—",
    `Letters: ${stats.letters}`,
    `Characters: ${stats.characters}`,
    `Sentences: ${stats.sentences}`,
    `Paragraphs: ${stats.paragraphs}`,
    "",
    stats.sentenceFeedback,
    "",
    stats.passiveVoiceFeedback,
  ];
  return lines.join("\n");
}
