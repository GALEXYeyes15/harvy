import { ensureHunspellLoaded } from "../src/features/proofread/mechanics/hunspellDictionary.ts";
import { registerCustomSpellingWords } from "../src/features/proofread/mechanics/commonWordList.ts";
import {
  isLikelyProperNounOrBrand,
  isSpellingCorrectInDictionary,
  isSpellingTokenValid,
  lookupSpellingWord,
  scanSpellingIssues,
} from "../src/features/proofread/mechanics/spellingChecker.ts";

await ensureHunspellLoaded();

let failed = false;

function assertValid(label, word) {
  if (!isSpellingTokenValid(word)) {
    failed = true;
    console.error(`FAIL ${label}: expected valid, got misspelling for "${word}"`);
    return;
  }
  console.log(`OK ${label}`);
}

function assertMisspelling(label, text, expectedWord) {
  const hits = scanSpellingIssues(text);
  const match = hits.find((hit) => hit.start === text.indexOf(expectedWord));
  if (!match) {
    failed = true;
    console.error(`FAIL ${label}: expected misspelling for "${expectedWord}" in "${text}"`);
    console.error(`  hits: ${JSON.stringify(hits.map((h) => text.slice(h.start, h.end)))}`);
    return;
  }
  console.log(`OK ${label}`);
}

function assertNoHits(label, text) {
  const hits = scanSpellingIssues(text);
  if (hits.length > 0) {
    failed = true;
    console.error(`FAIL ${label}: unexpected hits in "${text}"`);
    for (const hit of hits) {
      console.error(`  - ${text.slice(hit.start, hit.end)} (${hit.message})`);
    }
    return;
  }
  console.log(`OK ${label}`);
}

console.log("=== lowercase lookup ===");
assertValid("Apple when apple is valid", "Apple");
assertValid("apple lowercase", "apple");
if (lookupSpellingWord("Apple") !== "apple") {
  failed = true;
  console.error('FAIL lookupSpellingWord("Apple") should be "apple"');
} else {
  console.log('OK lookupSpellingWord("Apple") → "apple"');
}
if (!isSpellingCorrectInDictionary("Apple")) {
  failed = true;
  console.error('FAIL isSpellingCorrectInDictionary("Apple")');
} else {
  console.log('OK isSpellingCorrectInDictionary("Apple")');
}

console.log("\n=== proper nouns / brands ===");
assertValid("Phillips capitalized name", "Phillips");
assertValid("Skool via proper-noun heuristic", "Skool");
assertValid("Hyrule place name", "Hyrule");
if (!isLikelyProperNounOrBrand("Phillips")) {
  failed = true;
  console.error("FAIL isLikelyProperNounOrBrand(Phillips)");
}

registerCustomSpellingWords(["Skool"]);
assertValid("Skool in custom dictionary", "Skool");

console.log("\n=== still catch lowercase misspellings ===");
assertMisspelling("wierd typo", "That is wierd.", "wierd");
assertMisspelling("teh typo", "Fix teh typo.", "teh");
assertNoHits("Apple in prose", "Apple pie is good.");
assertNoHits("Phillips in prose", "Phillips makes light bulbs.");

console.log("\n=== acronyms / uppercase ===");
assertMisspelling("TEH uppercase typo", "TEH word", "TEH");

if (failed) {
  process.exit(1);
}

console.log("\nAll spelling casing checks passed.");
