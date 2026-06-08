/**
 * Local allow-list for rule-based spelling. Swap or extend when wiring nspell/Hunspell.
 * Words not in this set (and longer than 2 letters) are flagged as unknown spellings.
 */
const COMMON_WORDS_RAW = `
a about above across after again against all almost alone along already also although always
am among an and another any anyone anything are area around as ask at away back be became
because become been before began behind being below best better between big both but by
came can come could day did different do does down each early end enough even ever every
everyone everything far few find first for found from get give go good great had has have
he her here him his home how however i if in into is it its just keep know large last
left like line little long look made make man many may me mean men might more most move
much must my name need never new next no not now number of off often old on once one
only or other our out over own part people place put read right said same saw say see
seem set several she should show side since small so some something sometimes still such
take tell than that the their them then there these they thing think this those though
three through time to together too took turn two under until up us use very want was way
we well went were what when where which while who why will with without work world would
write year you young your receive received report feedback often forget check think simplify
clear point main final finalized being finalized
`;

export const COMMON_WORDS = new Set(
  COMMON_WORDS_RAW.split(/\s+/).filter((word) => word.length > 0),
);

/** True when `word` is in the local dictionary (case-insensitive). */
export function isCommonWord(word: string): boolean {
  const lower = word.toLowerCase();
  if (COMMON_WORDS.has(lower)) return true;
  // Possessive: "writer's" → "writer"
  const stripped = lower.replace(/'s$/, "");
  if (stripped !== lower && COMMON_WORDS.has(stripped)) return true;
  return false;
}
