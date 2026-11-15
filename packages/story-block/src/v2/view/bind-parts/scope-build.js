// Scope build: makes a binding scope from a State document and tells whether a value is one.

import { changedPointers } from './changes.js';
import { defaultFormatters } from './formatters.js';
import { contains, len, sum } from './list-helpers.js';
import { pct, ratio } from './ratio-pct.js';
import { POINTERS } from './path-names.js';
import { CHANGED, EMPTY, changedHelper } from './scope-shared.js';

/** The flat view of a State document the scope's `state` root reads (`{ v, meta, ...domains }`). */
export function stateView(state) {
    if (!state || typeof state !== 'object') return Object.freeze({});
    return Object.freeze({ ...(state.domains ?? {}), v: state.v, meta: state.meta });
}

/**
 * Build a scope. `state` is the State document; `changed` is a Set (or array) of the JSON Pointers this
 * carrier's ops touched (the mounts' `changes`), or pass the carrier's `ops`; `formatters` overrides `fmt.money` / `fmt.time`; `query` (optional) is the host's
 * `query(name, args)`, for expressions such as `query('party.pc').level >= 3`. A missing draft is one
 * shared empty record, so building the scope again does not look like a new draft to the renderer.
 */
export function makeScope({ state = null, q = EMPTY, draft = EMPTY, settings = EMPTY, query = null, changed = null, ops = null, formatters = {} } = {}) {
    const pointers = changed instanceof Set ? changed : changedPointers(ops ?? (Array.isArray(changed) ? changed.map(path => ({ path })) : []));
    const format = { ...defaultFormatters, ...formatters };
    const fmt = Object.freeze({
        money: n => safeFormat(format.money, n),
        time: m => safeFormat(format.time, m),
    });
    const scope = { state: stateView(state), q: q ?? EMPTY, draft: draft ?? EMPTY, settings: settings ?? EMPTY, ratio, pct, len, contains, sum, fmt };
    if (typeof query === 'function') scope.query = query;
    Object.defineProperty(scope, POINTERS, { value: {}, enumerable: true });
    Object.defineProperty(scope, CHANGED, { value: pointers, enumerable: true });
    scope.changed = changedHelper(scope);
    return scope;
}

/** True for a scope made by makeScope (or derived from one). */
export const isScope = scope => Boolean(scope && typeof scope === 'object' && scope[CHANGED] instanceof Set);

function safeFormat(fn, value) {
    try {
        const text = fn(value);
        return typeof text === 'string' ? text : text === null || text === undefined ? '' : String(text);
    } catch {
        return '';
    }
}
