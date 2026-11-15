// Keeps what is worked out from a frozen value with the value: memo helper, its definition hash and byte size.
import { dataModuleHash } from '../../check.js';
import { bytes } from '../../interpreter.js';

// A frozen value (a branch of the state) never changes, so what is worked out from it is kept with it. No game state is cached:
// the keys are the values themselves and the answers are functions of them alone (the interpreter caches nothing else).
const hashes = new WeakMap(), sizes = new WeakMap();
const kept = (cache, value, compute) => {
    if (value === null || typeof value !== 'object' || !Object.isFrozen(value)) return compute(value);
    if (!cache.has(value)) cache.set(value, compute(value));
    return cache.get(value);
};
const hashOf = definition => kept(hashes, definition, dataModuleHash);
const sizeOf = value => kept(sizes, value, bytes);

export { kept, hashOf, sizeOf };
