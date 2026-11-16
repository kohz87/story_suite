// Story Director v2, part **cast**: what the enabled packs list (Story Block's query `packs.content({ kind: 'cast' })`), the
// scene the party is in, and the plain rules that decide where someone is (pure apart from the queries it is handed).
//
// A pack entry: { pack, packVersion, id, name, aliases?, about, look, voice?, personality?, history?, portrait?, start: { place,
// goal, routine? }, drawnTo?[], meters?, stages?, fields?, secrets?, canDieUnmet? }. Here only the words the world needs to move a
// person and to bring them in are read, cut to size; the entry itself goes to other modules whole, and only after the meeting.
// Public face: re-exports its parts.

export { ask } from './entries-parts/query.js';
export { readEntry, placeMatcher, castOf } from './entries-parts/packs.js';
export { shortName, packName } from './entries-parts/pack-names.js';
export { samePlace, locator, partyPlace, atParty } from './entries-parts/places.js';
export { pinnedKeys, presentKeys, seenKeys } from './entries-parts/scene.js';
export { travelOf, roadsOf, linksOf } from './entries-parts/travel.js';
export { routineHours, routineHolds } from './entries-parts/routine.js';
export { leanFight, foesSignature, foesLeftover, pulseResults } from './entries-parts/foes.js';
export { fightOn } from './entries-parts/fight.js';
