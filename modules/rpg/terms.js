// The `party.terms` answer: the word a level is called ("Lv"). The game header and the Card read it; before this nothing answered it and each fell back to "Lv" by itself.
export const LEVEL_WORD = 'Lv';

/** `party.terms` → { levelName }. The same word levelLabel (levels-parts/ranks.js) writes in "Lv 14", so a reader that joins the two says one word. */
export const termsQuery = () => ({ levelName: LEVEL_WORD });
