// Scope shared: the empty record, the changed-pointers symbol and the `changed(path)` helper every scope kind uses.

import { touches } from './changes.js';
import { pointerOf } from './path-read.js';

export const EMPTY = Object.freeze({});

export const CHANGED = Symbol('ss.changed');

export function changedHelper(scope) {
    return path => {
        if (typeof path !== 'string') return false;
        const text = path.trim();
        const pointer = text === '' || text[0] === '/' ? text : pointerOf(scope, text);
        return touches(scope[CHANGED], pointer);
    };
}
