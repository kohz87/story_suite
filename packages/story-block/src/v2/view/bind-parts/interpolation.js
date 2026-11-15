// Interpolation: reads bound values as text and splits and renders `{{ }}` text.

import { compileExpr, evalExpr } from './expressions.js';

/** How a bound value reads as text: strings as they are, numbers and booleans as written, else ''. */
export function toText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    if (typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.filter(item => ['string', 'number'].includes(typeof item)).map(toText).join(', ');
    return '';
}

/**
 * Split `{{ }}` interpolation into parts: strings and compiled expressions. Returns null when the text has
 * no complete `{{ … }}` (it is static).
 */
export function parseInterpolation(text) {
    const source = String(text ?? '');
    if (!source.includes('{{')) return null;
    const parts = [];
    let at = 0;
    for (;;) {
        const open = source.indexOf('{{', at);
        const close = open < 0 ? -1 : source.indexOf('}}', open + 2);
        if (open < 0 || close < 0) {
            if (at < source.length) parts.push(source.slice(at));
            break;
        }
        if (open > at) parts.push(source.slice(at, open));
        parts.push(compileExpr(source.slice(open + 2, close)));
        at = close + 2;
    }
    return parts.some(part => typeof part !== 'string') ? parts : null;
}

/** Interpolated text: every expression part read as text. */
export function interpolate(parts, scope, evaluate = null, onWarn = null) {
    return parts.map(part => (typeof part === 'string' ? part : toText(evalExpr(part, scope, evaluate, onWarn)))).join('');
}
