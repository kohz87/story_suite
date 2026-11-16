// Small helpers shared by the scene and inventory domains. Pure. Public face: re-exports its parts.

export { OWNER_RE, isPlainObject, clone } from './common-parts/values.js';
export { labelOf, parseCount } from './common-parts/lines.js';
export { newId } from './common-parts/ids.js';
export { ownerName, ownerNameIn, capitalize } from './common-parts/owners.js';
