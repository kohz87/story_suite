// The small pure value helpers: the plain-object test, JSON byte size, deepFreeze and a state's rev.

export const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const utf8 = new TextEncoder();
export const jsonBytes = value => utf8.encode(JSON.stringify(value)).length;

// The ops' deepFreeze (one freeze for the whole host): it also remembers what it froze all the way down, so a state the store
// hands out is known deep-frozen at once (ops isDeepFrozen) and a command or a step planned again never walks or copies it again (LPA).
export { deepFreeze } from '../../ops/freeze.js';

export const revOf = state => (Number.isInteger(state?.meta?.rev) ? state.meta.rev : 0);
