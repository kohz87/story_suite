// A screen's data bindings: the order they run in and running them through a query function.

import { isRecord } from './shared-record.js';

const REF = /^\$([A-Za-z_][A-Za-z0-9_]*)((?:\.[\w-]+)*)$/;

// ---------------------------------------------------------------------------------------------------
// Data bindings

function refsOf(value, out) {
    if (typeof value === 'string') {
        const match = REF.exec(value);
        if (match) out.add(match[1]);
    } else if (Array.isArray(value)) value.forEach(item => refsOf(item, out));
    else if (isRecord(value)) Object.values(value).forEach(item => refsOf(item, out));
    return out;
}

/**
 * The order the bindings run in: each after the bindings its `$alias` arguments name, otherwise in the
 * order written. → { ok: true, order } | { ok: false, code: 'UNKNOWN_ALIAS' | 'CYCLE', message }
 */
export function dataOrder(data) {
    const aliases = isRecord(data) ? Object.keys(data) : [];
    const needs = new Map();
    for (const alias of aliases) {
        const refs = refsOf(data[alias]?.args, new Set());
        for (const ref of refs) {
            if (!Object.hasOwn(data, ref)) {
                return { ok: false, code: 'UNKNOWN_ALIAS', message: `data "${alias}" uses $${ref}, which is not one of this screen's data names.` };
            }
        }
        needs.set(alias, refs);
    }
    const order = [];
    const placed = new Set();
    while (order.length < aliases.length) {
        const next = aliases.find(alias => !placed.has(alias) && [...needs.get(alias)].every(ref => placed.has(ref)));
        if (next === undefined) {
            const stuck = aliases.filter(alias => !placed.has(alias));
            return { ok: false, code: 'CYCLE', message: `data ${stuck.map(alias => `"${alias}"`).join(', ')} depend on each other in a circle.` };
        }
        order.push(next);
        placed.add(next);
    }
    return { ok: true, order };
}

function pathValue(value, path) {
    let current = value;
    for (const key of path) {
        if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return null;
        current = current[key];
    }
    return current === undefined ? null : current;
}

function substitute(value, q) {
    if (typeof value === 'string') {
        const match = REF.exec(value);
        if (!match) return value;
        return pathValue(q[match[1]], match[2] ? match[2].slice(1).split('.') : []);
    }
    if (Array.isArray(value)) return value.map(item => substitute(item, q));
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, q)]));
    return value;
}

/**
 * Runs a screen's `data` bindings through `query(name, args)` in dependency order.
 * → { ok: true, q: { alias: value }, order, problems } | { ok: false, code, message }
 * A query that throws gives `null` for its alias and one plain line in `problems`; the screen still draws.
 */
export function resolveData(data, query) {
    if (data === undefined || data === null) return { ok: true, q: {}, order: [], problems: [] };
    if (!isRecord(data)) return { ok: false, code: 'INVALID', message: 'data must be an object of { query, args } bindings.' };
    const sorted = dataOrder(data);
    if (!sorted.ok) return sorted;
    const q = {};
    const problems = [];
    for (const alias of sorted.order) {
        const binding = data[alias];
        const args = substitute(binding.args ?? {}, q);
        try {
            const value = query(binding.query, args);
            q[alias] = value === undefined ? null : value;
        } catch (error) {
            q[alias] = null;
            problems.push(`${alias}: ${error?.message ?? String(error)}`);
        }
    }
    return { ok: true, q, order: sorted.order, problems };
}
