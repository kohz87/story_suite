// The [Rolls] cue (SPEC_RPG_v1 §4.5.3 step 5): what the narrator is told under [Happened], and what a refused action
// says. Short lines, one per roll; the numbers are always "the party member's total vs the foe's (or the difficulty)".
// Model-facing text, kept to the cue budget (names.js LIMITS.cueTokens).
// Public face: re-exports its parts.

export { offerLine } from './cue-parts/offer.js';
export { wearLine, OUTCOME_WORD, cueTokens, recoveryWords } from './cue-parts/words.js';
export { itemLineText } from './cue-parts/items.js';
export { shortNames } from './cue-parts/short-names.js';
export { lineText } from './cue-parts/lines.js';
export { hurtsOf } from './cue-parts/bars.js';
export { cueText } from './cue-parts/text.js';
export { OPEN_FIGHT_LINE, NO_ROLLS_LINE } from './cue-parts/fixed-lines.js';
export { fitCue } from './cue-parts/fit.js';
export { cueOfResult, receiptWithCue, entriesWithCue, receiptCue } from './cue-parts/receipt.js';
