// What a Re-read keeps of the mood: the stored form of a leaf, the mood write and its history, and whether the earlier read had a mood.
import { isObject, leafText, own, readLeaf } from '../npc-meters-config.js';
import { decayMood, nextMoodLog } from '../npc-mood.js';

// A Re-read of a reply (the host gives ctx.standing: the story as it stood after that reply's earlier read) gives the reply's mood only where that
// state already had one on this person: a reply written before the feature was on is read again as it was; a reply written with it on keeps
// its mood. A first read (no standing) always may.
// A leaf is written in the form the reply's earlier read stored it: an object where the standing holds one (a chat written under 1.16.0, whose later
// per-field ops need the object), text otherwise (a first read, a new reply). So a Re-read of an old reply stores the same ops.
export const asStored = (ctx, key, field, value) => (isObject(ctx?.standing?.domains?.npc?.npcs?.[key]?.[field]) ? value : leafText(value));
/** Writes a mood move on the record in the line's own op: the new mood and, when an axis moved from `prev` settled to `day`, the reply's entry of the mood history (record.moodLog). */
export function writeMood(ctx, key, record, { prev, mood, day, n = null, s = null, date = '', why = mood.cause }) {
    const was = decayMood(prev, day);
    record.mood = asStored(ctx, key, 'mood', mood);
    // A Re-read of a reply the older code read (the standing holds no mood history for the person) keeps writing what that read wrote: no history entry.
    const text = !ctx.standing || own(ctx.standing.domains?.npc?.npcs?.[key], 'moodLog') ? nextMoodLog(record.moodLog, { n, s, date, change: { v: mood.v - was.v, a: mood.a - was.a, d: mood.d - was.d }, why }) : null;
    if (text) record.moodLog = asStored(ctx, key, 'moodLog', JSON.parse(text));
}

export const moodStands = (ctx, key) => !ctx.standing || isObject(readLeaf(ctx.standing.domains?.npc?.npcs?.[key]?.mood));
