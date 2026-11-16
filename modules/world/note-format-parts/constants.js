// Story Director: the note's item separator and per-field word limits.
export const ITEM_SEPARATOR = ' · ';

// The most words of one part the note writes (v0.8.4): what a record is doing and when in 12,
// what it is (desc, a quest's goal, step, giver and reward, the foes of a fight) in 16. A longer
// part ends in "…" in the note only; the tracker, the tabs and the API keep every word.
export const NOTE_PART_WORDS = Object.freeze({
    now: 12, then: 12, on: 12, due: 12, arrive: 12,
    desc: 16, goal: 16, step: 16, reward: 16, giver: 16, encounter: 16, type: 16, shown: 16,
    // (0.9.19) A beat's reach, on Due now only: enough for one consequence and who it falls on.
    reach: 16,
});
