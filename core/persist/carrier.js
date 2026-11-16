// Story Suite v2: carrier identities, record keys and the shape check used by the persistence readers.
// `isObject` is shared by the persistence parts; `wellFormed` is the record shape a checkpoint reader trusts. Public face: re-exports its parts.

export { KEY, isObject, isCarrier, swipeOf } from './carrier-parts/identity.js';
export { newRecordId, carrierIndexes, lastCarrier } from './carrier-parts/lookup.js';
export { wellFormed, recordFault } from './carrier-parts/shape.js';
