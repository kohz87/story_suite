/* Provenance of a fill guess: which traits were guessed and when a story line settles them. A part of appearance-physical.js (same owner, moved without change). */
import { TRAIT_AXES } from './swap-axes.js';
import { traitPieces } from './trait-pieces.js';
import { physicalTraitSwaps } from './trait-swaps.js';

// ---- Provenance of a fill guess (appearance-fill.js). The fill call's invented hair / eyes / build are the only physical values a later
// story line may replace (owner, DECISIONS 90 and 113); `record.lookGuess` lists those trait keys. A record without the list (every
// card trait, every story-given or hand-written value, and any guess filled before this list existed) is fully protected.
export const guessedTraits = record => new Set((Array.isArray(record?.lookGuess) ? record.lookGuess : []).filter(key => TRAIT_AXES[key]));
const traitKeysOf = text => new Set(traitPieces(text).flatMap(piece => piece.keys));
/** The guess list after a fill call wrote `after` over `before`: the traits it newly names are guesses. */
export function filledGuess(record, before, after) {
    const had = traitKeysOf(before);
    return [...new Set([...guessedTraits(record), ...[...traitKeysOf(after)].filter(key => !had.has(key))])];
}
/** The guess list after an accepted text: a trait the text swapped is now the story's (established), no longer a guess. */
export function settledGuess(record, before, after) {
    const swapped = new Set(physicalTraitSwaps(before, after).map(swap => swap.trait));
    return [...guessedTraits(record)].filter(key => !swapped.has(key));
}
const lookOf = record => [record?.overallAppearance, record?.appearance].filter(Boolean).join('; ');
/** `after` with its guess list settled against what changed since `before` (a merge path that wrote the look without applyAppearanceUpdate). */
export function withSettledGuess(before, after) {
    const held = guessedTraits(after);
    if (!held.size) return after;
    const next = settledGuess(after, lookOf(before), lookOf(after));
    return next.length === held.size ? after : { ...after, lookGuess: next };
}
