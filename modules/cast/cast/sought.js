// Story Director v2, part **cast**: a kind of person the reader seeks ("a healer or sister around", a priest, a smith, a guide). Pure.
//
// The planner (plan.js, mode 'sought') may answer that an unmet person is SOUGHT, citing the words of the reader's message (or the story's last
// reply) that ask for them. Code checks the citation like the RPG's foe check: the cited words must stand in those texts as whole words, so a
// phrase the model made up is refused (`citedIn`). Here too: the cheap check that a message may be asking for someone at all (`kindTouches`),
// and the rumor, a description of a sought person who is elsewhere that never carries their name or an alias (`rumorText`).
// Public face: re-exports its parts.

export { MAX_CITED, citedClean, citedIn, words } from './sought-parts/cite.js';
export { fold, nameTester } from './sought-parts/names.js';
export { kindWords, leadOf } from './sought-parts/kind.js';
export { citesKind, gateWords, kindTouches } from './sought-parts/match.js';
export { MAX_RUMOR, rumorText } from './sought-parts/rumor.js';
