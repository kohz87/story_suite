// Shared state access, caches and checked-definition helpers for data modules (moved out of
// data-modules/part.js unchanged): pin/instance paths, budgets, and the checked target.
// Public face: re-exports its parts.
export { E, B, SET_FIELDS } from './shared-parts/texts.js';
export { rpg, J } from './shared-parts/rpg-access.js';
export { kept, hashOf, sizeOf } from './shared-parts/memo.js';
export { initial, draftOf, stateOf, pairKey } from './shared-parts/domain-access.js';
export { subjectsOf, activeCount, blockCount, instancePath } from './shared-parts/domain-counts.js';
export { partyWitness, partyLimit } from './shared-parts/party-witness.js';
export { partyPairs, partyRoomOf, partyFull } from './shared-parts/party-room.js';
export { rawDefinition, prefixImports, checkedTarget, newInstance } from './shared-parts/definitions.js';
