// The job: checking `start.world` (spec v0.14.10): `{ set: ["<condition>@<ref>[: <duration>]", ...], facts: ["<fact id>", ...] }`, the world the story begins in.
// Conditions are fixed names (no placeholders); every fact id counts as written by the pack.

import { SLUG } from '../../limits.js';
import { isObject } from '../core.js';
import { checkConditionText } from './entries.js';

const LIMIT = 24;

/** `ctx` as the event check's, with `placeholders: false`, rooted at "start". Returns the kept `{ set?, facts? }` (a plain copy), or null. */
export function checkStartWorld(value, ctx) {
    const { say } = ctx;
    if (!isObject(value)) return say('world', 'start.world must be { "set": ["at-war@the-march: 1 year"], "facts": ["border-closed"] }.'), null;
    for (const key of Object.keys(value)) if (key !== 'set' && key !== 'facts') say(`world.${key}`, `"${key}" is not a start.world field (set, facts).`, 'UNKNOWN_FIELD');
    const out = {};
    if (value.set !== undefined) {
        if (!Array.isArray(value.set) || value.set.length > LIMIT) say('world.set', `start.world.set must be a list of at most ${LIMIT} condition strings.`);
        else {
            value.set.forEach((text, n) => checkConditionText(text, ctx, `world.set[${n}]`));
            out.set = value.set.map(text => String(text).trim());
        }
    }
    if (value.facts !== undefined) {
        if (!Array.isArray(value.facts) || value.facts.length > LIMIT || value.facts.some(id => typeof id !== 'string' || !SLUG.test(id))) say('world.facts', `start.world.facts must be a list of at most ${LIMIT} fact ids (lower-case-with-hyphens).`);
        else { out.facts = [...value.facts]; for (const id of out.facts) ctx.collect.facts.add(id); }
    }
    return ctx.ok() ? out : null;
}
