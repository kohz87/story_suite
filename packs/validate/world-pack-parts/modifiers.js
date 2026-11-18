// The job: checking a `likelier_if` / `less_if` map (spec §3, §5): keys are conditions, anchors or (v0.14) thresholds, values are ×N odds modifiers.

import { isObject } from '../core.js';
import { checkEntry } from './entries.js';

const MODIFIER = /^×(\d+(?:\.\d+)?)$/;

/** `ctx` is the event's or template's check context. Says one Problem per bad key or value. */
export function checkModifiers(map, ctx, field) {
    if (!isObject(map)) return ctx.say(field, `${field} must be { "<condition>@<ref>": "×2" }.`);
    for (const [key, value] of Object.entries(map)) {
        checkEntry(key, ctx, `${field}.${key}`, ['threshold', 'anchor', 'condition']);
        if (typeof value !== 'string' || !MODIFIER.test(value.trim())) ctx.say(`${field}.${key}`, `"${String(value)}" is not a modifier; write ×N (×2, ×0.5; ×0 blocks), not a percentage.`);
    }
}
