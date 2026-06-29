import { ensureHunspellLoaded } from "../src/features/proofread/mechanics/hunspellDictionary.ts";
import { getSpellingSuggestions } from "../src/features/proofread/mechanics/spellingChecker.ts";

await ensureHunspellLoaded();

const cases = ["recieeve", "helllo", "wrd", "teh", "xkjfh", "undersanding"];

for (const word of cases) {
  const suggestions = getSpellingSuggestions(word, 3);
  console.log(`${word}: ${suggestions.length ? suggestions.join(", ") : "(none)"}`);
}
