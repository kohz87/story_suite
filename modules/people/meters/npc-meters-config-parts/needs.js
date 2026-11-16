// Parsing a rung's needs from a settings text and checking a need is met.
import { MAX_NEEDS } from './limits-pacing.js';
import { CUSTOM_RANGE } from './built-in-meters.js';
import { isObject, isInt, clamp } from './values.js';
import { clean, intOr } from './text.js';
import { slug } from './slugs.js';

/**
 * A rung's needs from a settings text: `trust 60, affection >= 40, tension <= -10` (also joined by
 * "and" or "&") → [{ meter, at, below }]. A plain number at 0 or more is "at or above", a negative one
 * "at or below" (the stages' rule); `<=` and `>=` say it outright. A record { trust: 60 } or a list of
 * { meter, at } is read too. At most six; parts that do not read are left out.
 */
export function parseNeeds(value) {
    const out = [];
    const push = (meter, at, op) => {
        const id = slug(meter);
        if (!id || !isInt(at) || out.length >= MAX_NEEDS || out.some(need => need.meter === id)) return;
        const below = op === '<=' || op === '≤' ? true : op === '>=' || op === '≥' ? false : at < 0;
        out.push(Object.freeze({ meter: id, at: clamp(at, CUSTOM_RANGE.min, CUSTOM_RANGE.max), below }));
    };
    if (Array.isArray(value)) {
        for (const item of value) if (isObject(item)) push(item.meter, intOr(item.at, null), item.below === true ? '<=' : item.below === false ? '>=' : null);
    } else if (isObject(value)) {
        for (const [meter, at] of Object.entries(value)) push(meter, intOr(at, null), null);
    } else {
        for (const part of String(value ?? '').split(/,|;|&|\band\b/iu)) {
            const match = /^([\p{L}][\p{L}\p{N} _-]*?)\s*(>=|≥|<=|≤|=|at)?\s*([+\-−]?\d{1,4})$/u.exec(clean(part, 80));
            if (match) push(match[1], Number(match[3].replace('−', '-')), match[2] ?? null);
        }
    }
    return Object.freeze(out);
}

export const needMet = (need, value) => (need.below ? value <= need.at : value >= need.at);
