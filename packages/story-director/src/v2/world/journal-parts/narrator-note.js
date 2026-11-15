// Story Director v2, journal: tells the fight board's narrator note (the code's own instruction) from a real event line.

// A day stored before the digest left bookkeeping out can still hold the fight board's narrator note (`rpg.resolve`'s summary, Story Block
// lean-rpg note.js settledNote): shown or counted as an event it is the code's own instruction. Matched by its fixed opening words.
// The fight board's note ("Tell … the settled fight results") and the older roll planner's ("[Rolls] Code rolled these …"), as stored in old days.
const NARRATOR_NOTE = /^(?:Tell (?:the approach, then )?the settled fight results in order; do not reroll them\.|\[Rolls\] Code rolled these)/;
/** Whether a stored "happened" line is that narrator note (the receipt is no longer known, so by its form). */
export const isNarratorNote = line => NARRATOR_NOTE.test(String(line ?? '').trim());
