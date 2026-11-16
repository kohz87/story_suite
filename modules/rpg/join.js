// Companions who join (mockup section 8): the narrator's one-line form for someone joining or leaving the party,
//   + party Mara | about: a hedge-witch from Kvildal | class: I | best: int
//   - party Mara
// and what code makes of it. Pure: no DOM, no commands. This file reads the line, checks it against the story's blocks, works out the
// character (stats 10, the named best stat 14, Soul Class as written but never above the party's highest, bars full) and the two
// definitions it is made of (the wizard's buildDefinitions, so a story-made companion is the same blocks a reader-made one is). The
// block engine (data-modules/part.js) makes them as one guarded action; the card under the reply (Ask) is read from the reply's own
// receipts, so a swipe, a delete or a Re-read takes it away with the reply and nothing is kept in the story's state for it.
// Public face: re-exports its parts.

export { joinMode, checkJoin } from './join-parts/check.js';
export { joinGrammar, joinGrammarOwn, soulOf, readJoin } from './join-parts/line.js';
export { JOIN_NO, JOIN_BENCH, JOIN_ADD } from './join-parts/commands.js';
export { soulNaming, partyOf, partyCap, benchable } from './join-parts/party.js';
export { joinDraft, joinDefinitions, joinScale } from './join-parts/draft.js';
export { joinOffers } from './join-parts/offers.js';
export { joinCard } from './join-parts/card.js';
