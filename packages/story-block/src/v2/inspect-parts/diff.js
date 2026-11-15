// What changed between two states, path by path.

import { LIMITS, pointer, isPlain } from './shared.js';

/**
 * What changed from `before` to `after`, path by path, in key order of `after` (removed keys after the
 * kept ones): `{ entries: [{ kind, path, before, after }], more }` with at most `limit` entries (`more`:
 * how many were left out). A list that changed is compared element by element; an object that came or
 * went is one entry, not one per key inside it.
 */
export function diffStates(before, after, { limit = LIMITS.diff } = {}) {
    const entries = [];
    let more = 0;
    const push = entry => {
        if (entries.length < limit) entries.push(entry);
        else more += 1;
    };
    const walk = (a, b, path) => {
        if (Object.is(a, b)) return;
        const bothLists = Array.isArray(a) && Array.isArray(b);
        const bothObjects = isPlain(a) && isPlain(b);
        if (!bothLists && !bothObjects) {
            push({ kind: 'change', path, before: a, after: b });
            return;
        }
        const keys = bothLists
            ? Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i)
            : [...Object.keys(b), ...Object.keys(a).filter(key => !Object.hasOwn(b, key))];
        for (const key of keys) {
            const has = { a: bothLists ? key < a.length : Object.hasOwn(a, key), b: bothLists ? key < b.length : Object.hasOwn(b, key) };
            const at = pointer(path, key);
            if (has.a && !has.b) push({ kind: 'remove', path: at, before: a[key], after: undefined });
            else if (!has.a && has.b) push({ kind: 'add', path: at, before: undefined, after: b[key] });
            else walk(a[key], b[key], at);
        }
    };
    if (before === null || before === undefined) {
        if (after !== null && after !== undefined) push({ kind: 'add', path: '', before: undefined, after });
    } else if (after === null || after === undefined) {
        push({ kind: 'remove', path: '', before, after: undefined });
    } else {
        walk(before, after, '');
    }
    return { entries, more };
}
