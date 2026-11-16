// Small schema checks for domain validators (SPEC §2.5, exposed as `sdk.check`). Each returns '' when
// the value is fine, else a short phrase the caller puts after the field's name ("qty must be a whole
// number"). `arrayOf` and `record` build a check for a list or an ID-keyed record from a check for one
// value. Pure.
// Public face: re-exports its parts.
export { RECORD_ID, DEF_ID, isId, id } from './check-parts/ids.js';
export { int, str, oneOf, bool } from './check-parts/scalars.js';
export { arrayOf, record } from './check-parts/combinators.js';
