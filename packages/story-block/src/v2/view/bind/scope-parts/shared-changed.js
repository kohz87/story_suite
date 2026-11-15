// The scope's changed() check and the private symbol that marks a scope and carries its changed pointers.

import { touches } from '../changes.js';
import { pointerOf } from '../paths.js';

export const CHANGED = Symbol('ss.changed');

/** True for a scope made by makeScope (or derived from one). */
export const isScope = scope => Boolean(scope && typeof scope === 'object' && scope[CHANGED] instanceof Set);

export function changedHelper(scope) {
    return path => {
        if (typeof path !== 'string') return false;
        const text = path.trim();
        const pointer = text === '' || text[0] === '/' ? text : pointerOf(scope, text);
        return touches(scope[CHANGED], pointer);
    };
}
