import { describe, expect, it } from "vitest";
import { collectAdverbHits } from "../../writing-assistance/adverbRules";
import { scanSuggestionIssues } from "./suggestionRules";

describe("scanSuggestionIssues", () => {
  it("does not underline hedge words that Adverbs / Hedging already highlights", () => {
    const text = "I just really want to go, kind of.";
    const suggestions = scanSuggestionIssues(text);
    const hedges = collectAdverbHits(text);

    expect(hedges.map((h) => h.word).sort()).toEqual(["just", "kind of", "really"].sort());
    expect(suggestions.filter((hit) => /just|really|kind of|very|sort of|basically/i.test(text.slice(hit.start, hit.end)))).toEqual(
      [],
    );
  });

  it("still flags wordy phrases with a shorter replacement", () => {
    const text = "We left in order to eat.";
    const hits = scanSuggestionIssues(text);
    expect(hits.some((hit) => hit.replacement === "to")).toBe(true);
  });
});
