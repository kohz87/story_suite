// Story Director v2, part **chronicle**: the `chronicle` domain's shape, caps, validator and name
// lookups (pure).
//
// chronicle = {
//   events:   { [ev_id]: { id, name, summary, state, since, updated, place, factions, aka, rev, by?, keep? } },
//   factions: { [fa_id]: { id, name, summary, area, stance, aka, rev } },
//   seen:     [{ [ev_id]: round }],             // an older chat's rounds, written whole (read, never written now)
//   seenAt:   { [ev_id]: round },               // the round an open event was last in the tail, by key
//   round:    int,                              // tail picks made so far (chronicle.surface; a counter)
//   surfaced: null | [{ at, round, ids }],      // the pick for the reply being written
//   days:     { [day]: [Digest] },              // the day digests (days.js), each day a slot
//   written:  null | [{ through, days, at, skip }], // where the digests were last written (days.js)
//   dayFacts: { ["<day>.<rev>"]: entry },        // each reply's facts for the digest, until its day is written
//   noted:    null | [{ rev, minutes, from, settle }], // where those notes got to (days.js)
//   questLog: { ["<rev>"]: { thread, text } },  // the quest history lines (quest.details), kept by the note
// }
// An event is a lasting situation of the wider world (a war, a plague, a calamity) the story
// keeps moving: `state` is looming, ongoing or resolved. `since` and `updated` are story minutes
// stamped by code from the Director's clock when the line was read (null while the clock is not
// set), never written by the model. `rev` is the receipt that last changed the entry. `factions`
// are the names a line gave (a faction need not be in the chronicle to be named). `aka` keeps a
// name the entry had before the reader renamed it, so the story's old name still finds it.
// `by` and `keep` are written only by `chronicle.lasting` (a pack event's lasting change, capture.js): `by` is
// the `event:<id>` that wrote the entry, which locks its state against the story's own `world` lines (the
// reader's edits and another `chronicle.lasting` may still change it); `keep: true` puts an open entry in
// every reply's tail (at most MAX_KEPT, pick.js). `fire` is `{ rev, by }`, the receipt of the pack event
// that last changed the entry, so the Journal can tell the change on the day its event fired even after the entry's
// own `rev` has moved on (a `world` line in the same reply, a reader's edit). It is written whole with the entry's
// own fields, never kept apart. An entry no pack event wrote has none of these fields.
// `seenAt` and `surfaced` are kept apart from the events, so an event changes only when the story
// or the reader changes it. `seenAt` is per-reply bookkeeping (SPEC §2.2, a scratch field): each pick
// adds its events' rounds by key and removes closed ones by key, a world line that closes an event
// removes its key; nothing writes it whole, so deleting a reply never makes a later reply's change
// rewrite a deleted pick's rounds (final soak: a later world line was lost). `round` is a counter: a
// deleted pick takes its +1 away and later picks still count theirs, so a round kept in `seenAt` may
// be past `round` after a delete; that is read as "just shown", never refused. `surfaced` is a slot
// (../slot.js) the pick writes whole for its own reply. An id whose event is gone is passed over.
// `seen` (a slot) is an older chat's rounds: read under `seenAt`, never written again.
// Public face: re-exports its parts.

export { EVENT_ID, FACTION_ID, OPEN_STATES, STATES } from './domain-parts/limits-ids.js';
export { MAX_EVENTS, MAX_FACTIONS, MAX_KEPT, MAX_RESOLVED } from './domain-parts/limits-caps.js';
export { MAX_AKA, MAX_NAME, MAX_NAMED, MAX_SUMMARY } from './domain-parts/limits-text.js';
export { LASTING_BY, RUMOUR_DAYS, RUMOUR_OPEN_MAX } from './domain-parts/limits-lasting.js';
export { isRecord } from './domain-parts/shared-basics.js';
export { forgetSeen, initialChronicle, seenOf, surfacedOf } from './domain-parts/state.js';
export { cleanName, cleanSummary, keyOf } from './domain-parts/names.js';
export { findIn, newId, revOf } from './domain-parts/lookup.js';
export { isLocked, isOpen, keptEvents, orderedEvents } from './domain-parts/order.js';
export { orderedFactions, prune } from './domain-parts/upkeep.js';
export { validateChronicle } from './domain-parts/validate.js';
