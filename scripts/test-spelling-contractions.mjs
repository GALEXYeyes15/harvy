import { ensureHunspellLoaded, getHunspell } from "../src/features/proofread/mechanics/hunspellDictionary.ts";
import { scanSpellingIssues } from "../src/features/proofread/mechanics/spellingChecker.ts";
import { countSpellingWords } from "../src/features/proofread/mechanics/spellingNormalize.ts";
import { countWords } from "../src/features/readability/index.ts";

const REQUIRED_WORDS = [
  "won't",
  "can't",
  "don't",
  "it's",
  "I'm",
  "you're",
  "they've",
  "we'll",
  "she'd",
  "John's",
  "company's",
];

await ensureHunspellLoaded();

let failed = false;

function assertNoFalsePositives(label, text) {
  const hits = scanSpellingIssues(text);
  if (hits.length > 0) {
    failed = true;
    console.error(`FAIL ${label}:`);
    for (const hit of hits) {
      console.error(`  - ${hit.message}`);
    }
    return;
  }
  console.log(`OK ${label}`);
}

const straight = REQUIRED_WORDS.join(" ");
const curly = straight.replace(/'/g, "\u2019");

assertNoFalsePositives("straight apostrophe", straight);
assertNoFalsePositives("curly apostrophe", curly);
assertNoFalsePositives("mixed contractions in prose (straight)", "I won't say can't or don't.");
assertNoFalsePositives(
  "mixed contractions in prose (curly)",
  "I won\u2019t say can\u2019t or don\u2019t.",
);
assertNoFalsePositives("possessives (curly)", "John\u2019s company\u2019s");

const spell = getHunspell();
for (const word of REQUIRED_WORDS) {
  const curlyWord = word.replace(/'/g, "\u2019");
  if (!spell.correct(word) && !spell.correct(word.toLowerCase())) {
    failed = true;
    console.error(`FAIL hunspell direct: ${word}`);
  }
  if (!spell.correct(curlyWord)) {
    failed = true;
    console.error(`FAIL hunspell direct (curly): ${curlyWord}`);
  }
}

console.log("\n=== word count ===");
for (const word of REQUIRED_WORDS) {
  const straightCount = countWords(word);
  const curlyCount = countWords(word.replace(/'/g, "\u2019"));
  if (straightCount !== 1 || curlyCount !== 1) {
    failed = true;
    console.error(`FAIL word count: ${word} straight=${straightCount} curly=${curlyCount}`);
  }
}

const prose = "Hello world";
if (countWords(prose) !== 2 || countSpellingWords(prose) !== 2) {
  failed = true;
  console.error("FAIL normal word count regression");
} else {
  console.log("OK normal word count");
}

if (!failed) {
  console.log("OK contraction word counts");
}

if (failed) {
  process.exit(1);
}

console.log("All contraction/possessive spelling checks passed.");
