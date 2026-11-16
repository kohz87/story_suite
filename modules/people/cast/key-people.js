// Key people, read from Story Director (the user's decision, 1 Nov): Story Director owns who is a key person and
// where they are when they are away; Delta only READS its query `director.keyPeople` and shows it in the dossier,
// on the present cards and in the narrator's dossier text, and holds a key person's stable fields still while
// they are away. Nothing here writes to Story Director. Without Story Director, or with one that lacks the
// query, `keyPeople()` is null and nothing anywhere changes: Delta alone has no key people.
//
// The query: `director.keyPeople` → [{ name, aliases?, here: bool, away: { doing, since, back, steps: [{ date,
// text }] } | null, removed?: { reason, on } }]. A `removed` entry is no longer a key person (archived, dead or
// unpinned): it gets no badge, no section and no hold. `since`, `back` and a step's `date` are story minutes (null when not
// known); the adapter's `storyMinuteText` writes them as "Goldwane 18" on Story Director's calendar.
//
// The answer says only who is away NOW. After the return it is null again, so Delta keeps a small memory of the
// last absence in the saved npc slice (`keyAway`, by `memoryKey`; written by npc.tick, src/npc-meters.js observeKeyAway, so it
// follows swipes, deletes and reloads with the replies) to show "While away" until the person has been present for a few
// replies, and to give the narrator the summary once. Everything here is pure and takes its inputs; index.js, the
// adapter and core.js call it.
//
// Public face: re-exports its parts.
export { AWAY_LOCKED_FIELDS, RECENT_REPLIES, RETURN_NOTE_CHARS } from './key-people-parts/constants.js';
export { labelKey } from './key-people-parts/shared-text.js';
export { normalizeKeyPeople } from './key-people-parts/answer.js';
export { findKeyEntry, isAway, isKey, labelsOf } from './key-people-parts/entries.js';
export { awayNpcIds, awayRange, returnNote } from './key-people-parts/away.js';
export { keyView, memoryKey } from './key-people-parts/memory.js';
export { lockAwayNpcs } from './key-people-parts/lock.js';
