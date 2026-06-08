import { ensureHunspellLoaded } from "./hunspellDictionary";
import { runMechanicsProofread } from "./mechanicsEngine";
import { MECHANICS_SAMPLE_PARAGRAPH } from "./sampleParagraph";

await ensureHunspellLoaded();

const issues = runMechanicsProofread(MECHANICS_SAMPLE_PARAGRAPH);

const byType = {
  spelling: issues.filter((i) => i.type === "spelling"),
  grammar: issues.filter((i) => i.type === "grammar"),
  suggestion: issues.filter((i) => i.type === "suggestion"),
};

console.log("Mechanics sample paragraph verification");
console.log("—".repeat(48));
console.log(MECHANICS_SAMPLE_PARAGRAPH);
console.log("—".repeat(48));
console.log(`Total issues: ${issues.length}`);
console.log(`Spelling: ${byType.spelling.length}`);
console.log(`Grammar: ${byType.grammar.length}`);
console.log(`Suggestions: ${byType.suggestion.length}`);
console.log("—".repeat(48));

for (const issue of issues) {
  console.log(
    `[${issue.type}] ${JSON.stringify(issue.text)} → ${issue.suggestion ?? "(no suggestion)"} @ ${issue.start}-${issue.end}`,
  );
}

if (byType.spelling.length === 0 || byType.grammar.length === 0 || byType.suggestion.length === 0) {
  console.error("Expected at least one issue in each category.");
  process.exit(1);
}
