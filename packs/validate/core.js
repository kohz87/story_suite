// Story Suite v2: the pack validator's shared helpers (moved out of packs/validate.js unchanged; validate.js re-exports the public ones):
// the host version a pack is checked against, the slug rule, the shape tests and the failure helper every check uses, and the
// reader of a pack's record lists.
// Public face: re-exports its parts.

export { HOST_VERSION, SUITE_VERSION } from './core-parts/host-version.js';
export { fail } from './core-parts/failure.js';
export { isObject, isInt, isText, isNumber } from './core-parts/shapes.js';
export { slugify, fullId } from './core-parts/record-ids.js';
export { records } from './core-parts/records.js';
export { shapeProblem } from './core-parts/template-shape.js';
