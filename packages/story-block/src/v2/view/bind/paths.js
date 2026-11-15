// Binding path syntax and reads: parse `name.key[0]['key']`, resolve it in a scope, turn it into a State JSON
// Pointer, and read or copy-write values by key. Reads use own properties and reject forbidden keys; writes reject them too.
// Public face: re-exports its parts.

export { IDENT, POINTERS, RESERVED } from './paths-parts/names.js';
export { parsePath, readPath, skipSpace } from './paths-parts/parse.js';
export { pathKeys, pointerOf, resolvePath } from './paths-parts/resolve.js';
export { setIn, valueAtKeys } from './paths-parts/keys.js';
