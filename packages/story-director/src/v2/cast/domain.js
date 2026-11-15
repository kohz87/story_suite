// Story Director v2, part **cast** (the living cast): the `cast` domain's shape, its validator and the pure helpers every
// other file of the part reads it with. Pure.
// Public face: re-exports its parts.
//
// cast = {
//   people: { [key]: person },          // key = `<pack>:<id>` (the pack's id and the entry's id)
//   notes:  { [id]: note },             // what a reply told its card (met someone, the cast moved on, the pack was updated); `at`: the message the card is under
//   day:     null | [{ at, rev }],      // a slot: the story minute the cast was last moved to (the planner's last batch)
//   meeting: null | [{ at, keys, rev, seen? }],// a slot: who comes into the scene in the reply being written (`at`: the chat's length)
// }
// person = { pack, eid (the entry's id; a field called `id` must be an ID like it_k3f9a2qz), name, aliases?, ver, joined, where, doing, since, alive, met, heard, rumored?, coming?, known?, rev }
//   ver:    the pack version of the entry as last seen (a string; '' when the pack gives none)
//   sig:    a short fingerprint of the entry's content (not its version), so an update is told apart from a version bump ('' when unknown)
//   joined: the story minute they joined the world (null while the clock is not set)
//   where / doing: where they are and what they do now (off-screen, kept by the planner's batches)
//   met:    null while unmet, else { on, where, why: 'place' | 'goal' | 'sought' | 'story', reason, rev, was? } (a meeting is recorded on the reply; `was`: where
//           a goal arrival was before it came to the party, so a meeting the reply did not show (`cast.withdraw`) puts them back there)
//   heard:  the last news of a met person: null | [{ on, text }] (a slot: written whole each time)
//   rumored: an unmet person the reader sought who is elsewhere: null | [{ on, where, at, rev }] (a slot: written whole; the rumor, which never
//           names them, was told in the reply at `at` and is not told again until met or until `where` is no longer where they are)
//   coming: an unmet person whose goal leads to the party but who is far: null | [{ from, to, start, arrive, reason, rev }] (a slot: the trip
//           towards the place `to`, landing at story minute `arrive`; dropped when the link goes, `cast.journey`)
//   known: after a planner move the atlas had no road for, the last place it had one for and the minute they left it: null | [{ where, since }]
//          (a slot; the reach rule counts the road trip from there too, world.js `canReach`; cleared by a move with a road or a landing)
// The pack entry itself (look, voice, history, secrets...) is never copied here: it is read from the pack when needed,
// and only for a person who has been met. Nothing stored here is read by a reader before the person is met.
//
// Replay-safe like every domain: a person is added whole under its key; a change inside a person is marked `ctx.ifThere`
// (passed over when the reply that made the person was deleted); a note is a new key each time and never changed; the two
// slots are written whole (../slot.js).

export { FEATURE, FACES, DEFAULT_FACES } from './domain-parts/settings.js';
export { MAX_NAME, MAX_PLACE, MAX_DOING, MAX_REASON } from './domain-parts/limits-text.js';
export { MAX_PEOPLE, MAX_STORED, MAX_ALIASES, MAX_KEY } from './domain-parts/limits-tables.js';
export { MAX_NOTE_REPLIES, NOTE_KINDS, WHYS } from './domain-parts/limits-notes.js';
export { isRecord, isInt } from './domain-parts/shared-checks.js';
export { flat, cutPoints, cutWords } from './domain-parts/text.js';
export { keyOf, personKey, keysOfPerson } from './domain-parts/keys.js';
export { DAY, dayOf, timeOfDay } from './domain-parts/time.js';
export { initialCast, tables, slotOf, dayAt } from './domain-parts/slice.js';
export { peopleOf, isMet, isAlive, counts } from './domain-parts/people.js';
export { validateCast } from './domain-parts/validate.js';
