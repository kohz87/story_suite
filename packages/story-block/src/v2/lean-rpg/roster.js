// The party roster (Story Block 2.18.1, docs/v2/GEAR.md "The roster"): the RPG answers `party.actors` and `party.pc` from its Character blocks, so
// each member of the party is an actor who can own and wear things.
//
//   party.actors  [{ id, name, pc? }]  (null while there is no Character: nothing answers, the `party` domain is looked at as before) one per Character block in the party (a companion who left is not on it), in block order; `pc: true` on the reader's own.
//   party.levels  [{ id, name, level, left }]  read only; every Character, those who left too (`left: true`); `level` the sheet's, null when it states none; needs the RPG only.
//   party.pc      { id }               the reader's own Character: the one named like the persona (an exact name, else a first name that means only them), or the
//                                      only Character; null when there are several and none is named so. Only the id: the header keeps the persona's name.
//
// The id is `ac_` + 8 base-36 characters worked out from the BLOCK's module id (`pack.chat/<slug>`), never from the name: a rename, a rebuild, a
// reload and a swipe all give the same one. Both queries are fallbacks (registry.js): a module that answers `party.actors` itself (an older RPG Battle chat) is the
// one asked, and these are not. They answer while the RPG is on (`feature`) and Gear in fights is on (`gearOn`), and read the state alone (plus the persona's name).
// Pure: no DOM, no SillyTavern.
// Public face: re-exports its parts.
export { actorIdOf } from './roster-parts/actor-id.js';
export { rosterOf, rosterQueries } from './roster-parts/party.js';
export { levelsOf, levelsQuery } from './roster-parts/levels.js';
