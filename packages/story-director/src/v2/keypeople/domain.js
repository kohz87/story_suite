// Story Director v2, part **keypeople**: the `keypeople` domain's shape, its validator and the pure helpers every
// other file of the part reads it with. Pure.
//
// keypeople = {
//   pins:  { [key]: { name, since, rev, aliases?, nsd?, npc? } },    // the key list: who is pinned (since: the story minute, or null; nsd: NPC State Delta knows them; npc: their np_ identity there)
//   away:  { [key]: { name, doing, since, back, steps: [{ date, text }], rev } }, // each pinned person who is away
//   gone:  { [key]: { name, reason, on, rev, owed? } },        // who was taken off the list and why (the newest MAX_GONE); owed: NPC State Delta's removal, its card line not told yet
//   notes: { [id]: { sid, kind, name, head, rest, lead, rev, key?, goneRev? } }, // what a reply changed (returned, no longer key), for its card; key + goneRev: the `gone` record a told removal is about
// }
// `key` is `lineKey(name)` (changes.js). Every thing is added whole under its key and one that goes is removed, so a
// reply deleted in the middle never breaks the replies after it (SPEC §2.2; slot.js says why). Times are the story
// clock in minutes, or null while it is not set. `back` is the day the person is due back (the day's start), or null.
// Nothing here reads a setting: the cap and the token budget are the writers' and the tail's (capture.js, note.js).
// Public face: re-exports its parts.

export { FEATURE, DEFAULT_CAP, DEFAULT_TOKENS } from './domain-parts/feature.js';
export { MAX_CAP, MAX_STORED, MAX_GONE, MAX_NOTE_REPLIES } from './domain-parts/limits-storage.js';
export { MAX_NAME, MAX_DOING, MAX_STEP, MAX_STEPS } from './domain-parts/limits-text.js';
export { MAX_ALIASES, REASONS, NOTE_KINDS } from './domain-parts/kinds.js';
export { isRecord, isInt, keyOf } from './domain-parts/primitives.js';
export { flat, cutPoints, cleanName } from './domain-parts/text.js';
export { initialKeyPeople, tables } from './domain-parts/state.js';
export { keysOfPin, findPin, awayOf } from './domain-parts/lookup.js';
export { validateKeyPeople } from './domain-parts/validate.js';
