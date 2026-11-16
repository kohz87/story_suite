// Reads a social-graph edge's relation text as one of the four tie kinds the People map draws; an edge no row matches has no kind and is left out.

// First matching row wins: rival (also enemies), owes, kin, then friend (friends, allies, partners, mentors, companions).
const ROWS = [
  ['rival', /\b(?:rivals?|enem(?:y|ies)|nemesis|foe|adversary|antagonist|feud\w*|hostile|hates?|loathes?)\b/i],
  ['owes', /\b(?:owes|owing|indebted|debt|beholden|creditor|oath-?bound|sworn to)\b/i],
  ['kin', /\b(?:mother|father|parents?|mom|dad|sister|brother|sibling|daughter|son|cousin|aunt|uncle|grand\w+|family|kin|spouse|wife|husband)\b/i],
  ['friend', /\b(?:friends?|ally|allies|partner|lover|companion|comrade|confidant\w*|mentor|teacher|apprentice|student|crewmate|trusted|loyal)\b/i],
];
const OWED_BY = /\b(?:owed by|owed to by|debtor)\b/i;

/** The tie kind (`friend`, `kin`, `rival` or `owes`) the two relation texts of an edge read as, or null. */
export function tieKind(aToB, bToA) {
  const lines = [aToB, bToA].map(line => String(line ?? ''));
  for (const [kind, pattern] of ROWS) {
    if (lines.some(line => pattern.test(line) && !(kind === 'owes' && OWED_BY.test(line)))) return kind;
  }
  return null;
}
