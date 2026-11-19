// The people view: turns an NPC State sidecar state into the plain, clock-free `people` slice that the Story Suite store keeps (records
// keyed by id, in order), and turns that slice back into the sidecar's people keys. History, rollback and scheduler keys are left out on purpose.
// Pure: no I/O, no host. `peopleState` turns the stored slice back into the people keys (PEOPLE_KEYS): the hydrate of people-sync.js uses it.
// Public face: re-exports its parts.

export { stripVolatile } from './view-parts/volatile.js';
export { peopleCarry, peopleView } from './view-parts/to-view.js';
export { PEOPLE_KEYS, peopleState } from './view-parts/to-state.js';
