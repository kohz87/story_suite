// Plain-JSON helpers for ops: the object test, the JSON check, defensive copies and deep equality.
// Objects without a prototype stay that way, and "__proto__" is written as an own key. Pure.
// Public face: re-exports its parts.

export { isPlainObject, setKey } from './json-parts/shared-shape.js';
export { isJson, jsonProblem } from './json-parts/check.js';
export { clone } from './json-parts/copy.js';
export { equal } from './json-parts/equal.js';
