// Story Director v2, chronicle part: list size caps for a day's kept facts. Pure.

// What a digest may hold.
// The kept lines of a day's events: the Journal sorts them into kinds and the search reads them (a day may hold a few dozen).
export const MAX_HAPPENED = 40;
// One entry's lists at most (an entry is one reply's part of a day, see entryOf).
export const ENTRY_HAPPENED = MAX_HAPPENED;
export const MAX_PLACES = 8;
export const MAX_QUESTS = 6;
