// The job: checking an `effects` block (set, clear, cast, powers, scores, facts, on_end) of an event or an outcome.

import { CAST_EFFECT_FIELDS, EFFECT_FIELDS, SLUG } from '../../limits.js';
import { isObject, isText } from '../core.js';
import { checkConditionText } from './entries.js';

const UNTIL = /^(?:end|permanent|cleared:.+)$/;
const list = (value, ctx, field, max = 24) => {
    if (!Array.isArray(value) || value.length > max) return ctx.say(field, `${field} must be a list of at most ${max} entries.`), [];
    return value;
};

function castEffects(entries, ctx, field) {
    list(entries, ctx, field).forEach((entry, n) => {
        const at = `${field}[${n}]`;
        if (!isObject(entry)) return ctx.say(at, `${at} must be an object like { "who": "sir-lothar", "location": "Ledgerford" }.`);
        for (const key of Object.keys(entry)) if (!CAST_EFFECT_FIELDS.includes(key)) ctx.say(`${at}.${key}`, `"${key}" is not a cast effect field (expected ${CAST_EFFECT_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (typeof entry.who === 'string' && ctx.index.refused.has(entry.who)) ctx.collect.warnings.push([`${at}.who`, `"${entry.who}" was refused (see the cast Problems); the step skips this entry.`]);
        else if (typeof entry.who !== 'string' || !ctx.index.person(entry.who)) ctx.say(`${at}.who`, `"${String(entry.who)}" is not a cast id; effects.cast.who names a cast entry by id.`, 'UNKNOWN_REF');
        if (entry.location !== undefined && !ctx.index.ref(entry.location).has('place')) ctx.say(`${at}.location`, `"${String(entry.location)}" is not a place of this pack.`, 'UNKNOWN_REF');
        if (entry.until !== undefined && (typeof entry.until !== 'string' || !UNTIL.test(entry.until))) ctx.say(`${at}.until`, 'until is "end", "permanent" or "cleared:<condition>@<ref>".');
        else if (typeof entry.until === 'string' && entry.until.startsWith('cleared:')) checkConditionText(entry.until.slice(8), ctx, `${at}.until`, { duration: 'forbid' });
        if (entry.died !== undefined && typeof entry.died !== 'boolean') ctx.say(`${at}.died`, 'died must be true or false.');
        // `from` (v0.14.6-v0.14.9): a place id the person must be in (its group) at the tick, or "anywhere".
        if (entry.from !== undefined && entry.from !== 'anywhere' && !(typeof entry.from === 'string' && ctx.index.ref(entry.from).has('place'))) ctx.say(`${at}.from`, `"${String(entry.from)}" is not a place of this pack (from is a place id or "anywhere").`, 'UNKNOWN_REF');
        for (const text of ['status', 'goal', 'routine']) if (entry[text] !== undefined && (!isText(entry[text], 300) || !entry[text].trim())) ctx.say(`${at}.${text}`, `${text} must be text of at most 300 characters.`);
    });
}

function standing(map, kind, ctx, field) {
    if (!isObject(map)) return ctx.say(field, `${field} must be { "<${kind} id>": ±N }.`);
    for (const [id, delta] of Object.entries(map)) {
        if (!ctx.index.standing(kind, id)) ctx.say(`${field}.${id}`, `"${id}" is not the id, or a unique name, of a ${kind} of this pack.`, 'UNKNOWN_REF');
        if (!Number.isFinite(delta) || !Number.isInteger(delta)) ctx.say(`${field}.${id}`, `the change to "${id}" must be a whole number (±N).`);
    }
}

/** `effects` of an event, an outcome or (`top: false`) an on_end. Writes to `ctx.collect`: facts written, conditions cleared, conditions set with a duration. */
export function checkEffects(effects, ctx, field, { top = true, cast = true } = {}) {
    if (!isObject(effects)) return ctx.say(field, `${field} must be an object of ${EFFECT_FIELDS.join(', ')}.`);
    for (const key of Object.keys(effects)) {
        if (!EFFECT_FIELDS.includes(key) || (key === 'on_end' && !top)) ctx.say(`${field}.${key}`, `"${key}" is not an effect${key === 'on_end' ? ' inside on_end' : ''} (expected ${EFFECT_FIELDS.filter(word => top || word !== 'on_end').join(', ')}).`, 'UNKNOWN_FIELD');
    }
    list(effects.set ?? [], ctx, `${field}.set`).forEach((text, n) => {
        const parsed = checkConditionText(text, ctx, `${field}.set[${n}]`);
        if (parsed?.duration) ctx.collect.timed.add(parsed.name);
    });
    list(effects.clear ?? [], ctx, `${field}.clear`).forEach((text, n) => {
        const parsed = checkConditionText(text, ctx, `${field}.clear[${n}]`, { duration: 'forbid' });
        if (parsed) ctx.collect.cleared.add(parsed.name);
    });
    if (effects.cast !== undefined) {
        if (!cast) ctx.say(`${field}.cast`, 'a template has no cast effects and never touches a named person.');
        else castEffects(effects.cast, ctx, `${field}.cast`);
    }
    if (effects.powers !== undefined) standing(effects.powers, 'power', ctx, `${field}.powers`);
    if (effects.scores !== undefined) standing(effects.scores, 'score', ctx, `${field}.scores`);
    list(effects.facts ?? [], ctx, `${field}.facts`).forEach((fact, n) => {
        const at = `${field}.facts[${n}]`;
        if (!isObject(fact) || typeof fact.id !== 'string' || !SLUG.test(fact.id) || !isText(fact.text, 300) || !fact.text.trim()) return ctx.say(at, `${at} must be { "id": "regency-declared", "text": "…" } (a fact carries an id so others can anchor on it).`);
        ctx.collect.facts.add(fact.id);
    });
    if (effects.on_end !== undefined) checkEffects(effects.on_end, ctx, `${field}.on_end`, { top: false, cast });
}
