// The JSON check: says whether a value is plain JSON and, if not, where and why not. Pure.

import { escapeKey } from '../paths.js';
import { isPlainObject } from './shared-shape.js';

/** True for plain JSON: null, booleans, strings, finite numbers, arrays and plain objects of those. */
export function isJson(value) {
    return jsonProblem(value, '') === '';
}

export function jsonProblem(value, path) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return '';
    if (typeof value === 'number') return Number.isFinite(value) ? '' : `${path || '/'} is ${value}, not a finite number.`;
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const problem = jsonProblem(value[i], `${path}/${i}`);
            if (problem) return problem;
        }
        return '';
    }
    if (isPlainObject(value)) {
        for (const key of Object.keys(value)) {
            const problem = jsonProblem(value[key], `${path}/${escapeKey(key)}`);
            if (problem) return problem;
        }
        return '';
    }
    const what = value === undefined ? 'undefined' : typeof value === 'object' ? 'not a plain object' : `a ${typeof value}`;
    return `${path || '/'} is ${what}; state holds plain JSON only.`;
}
