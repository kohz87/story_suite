// Compiling and judging a condition: a parse cached per source text, and whether the condition is met.

import { parse } from '../condition-parser.js';
import { evaluate, kindOf } from './walk.js';

const cache = new Map();
const CACHE_SIZE = 500;

/** Parse once per source text and options (conditions repeat every reply). Same result as `parse`. */
export function compile(source, options = {}) {
    let key = null;
    try {
        key = typeof source === 'string' ? JSON.stringify([options?.names === true, options?.calls ?? null, source]) : null;
    } catch {
        key = null;
    }
    if (key !== null && cache.has(key)) return cache.get(key);
    const parsed = parse(source, options);
    if (key !== null) {
        if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value);
        cache.set(key, parsed);
    }
    return parsed;
}

/**
 * Is this condition met? `{ met, value?, error? }`: met only when it parses, evaluates without error
 * and comes out exactly true. A condition that errors is not met and says why.
 */
export function evaluateCondition(source, env = {}) {
    const parsed = compile(source);
    if (!parsed.ok) return { met: false, error: parsed.error };
    const result = evaluate(parsed.ast, env);
    if (!result.ok) return { met: false, error: result.error };
    if (typeof result.value !== 'boolean') {
        return { met: false, value: result.value, error: { code: 'TYPE', message: `The condition gives ${kindOf(result.value)}, not true or false.`, at: 0 } };
    }
    return { met: result.value, value: result.value };
}
