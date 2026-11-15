// Data-modules checker, shape part: the message table `E`, the small validators every section uses (copy, stable,
// shape, sized, named, distinct, normalized keys, scalar, entries) and the display names of an int field. Pure: no state is read.
// Public face: re-exports its parts.
export { E, copy, entries, array } from './shape-parts/helpers.js';
export { stable, same, defId, normalizedKeys } from './shape-parts/values.js';
export { shape, sized, named, distinct } from './shape-parts/structure.js';
export { scalar } from './shape-parts/scalar.js';
export { names } from './shape-parts/names.js';
