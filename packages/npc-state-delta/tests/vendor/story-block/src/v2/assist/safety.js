// The Assist extractor's value wall (MODULES §F100, §F123): which of its lines may run at all. The
// extractor reads a finished reply and proposes the change lines its prose shows but its block left out;
// those lines never create value. Only the kinds the reader allows (a setting, `assistExtractorKinds`)
// are kept, and under any setting a line that would add coin, items, XP, loot, a new companion or skill,
// a heal is dropped. Lines read after the reader had sent (applied on the next reply)
// pass a stricter wall still: no coin and no new item at all, no quest turn-in (it pays a reward), nothing
// that adds. Pure: no DOM, no state.
// Public face: re-exports its parts.

export { DEFAULT_KINDS, KIND_CHOICES, allowedKinds } from './safety-parts/kinds.js';
export { refusedWhy, safeLines } from './safety-parts/wall.js';
export { BARRIER, heldWhy, momentaryHold, waitForBarrier } from './safety-parts/holds.js';
