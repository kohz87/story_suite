// Scope child: derives a scope with a new draft or with one loop item.

import { POINTERS } from './path-names.js';
import { EMPTY, changedHelper } from './scope-shared.js';

/** The same scope with a new draft (helpers, pointers and loop names kept). */
export function withDraft(scope, draft) {
    const next = { ...scope, draft: draft ?? EMPTY };
    next.changed = changedHelper(next);
    return next;
}

/**
 * A child scope for one loop item: `name` is the item, `indexName` (optional) its index or record key.
 * `pointer` is the item's JSON Pointer into the State, or null.
 */
export function withItem(scope, name, value, pointer = null, indexName = null, index = undefined) {
    const next = { ...scope, [name]: value };
    const pointers = { ...scope[POINTERS] };
    if (typeof pointer === 'string') pointers[name] = pointer;
    else delete pointers[name];
    if (indexName) {
        next[indexName] = index;
        delete pointers[indexName];
    }
    Object.defineProperty(next, POINTERS, { value: pointers, enumerable: true });
    next.changed = changedHelper(next);
    return next;
}
