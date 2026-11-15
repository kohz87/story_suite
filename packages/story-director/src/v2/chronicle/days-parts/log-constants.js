// Story Director v2, chronicle part: quest-log and day-facts key constants. Pure.

// The quest history (quest.details, F84) is read from receipts too: `chronicle.questLog["<rev>"] =
// { thread, text }` keeps, per receipt revision, the summary of each receipt that touched a quest or
// thread, written by the note on the reply it belongs to; the newest QUEST_LOG_KEPT per thread stay.
export const QUEST_LOG_KEPT = 8;
export const QUEST_LOG_TEXT = 200;
export const ENTRY_KEY = /^(-?\d{1,15})\.(\d{1,15})$/;
