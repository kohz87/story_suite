// The job: checking an open template's `open` (menu, writes_facts), `arc`, `per` and `fallback` (spec v0.14 §5). Each takes the check context of the template.
// The Director may only pick from the menu, so every id in it must exist; the number checks mirror what code enforces on the Director's result.

import { SLUG } from '../../limits.js';
import { durationDays } from '../../../modules/world/daily/durations.js';
import { isObject } from '../core.js';
import { checkConditionText } from './entries.js';

const AT = { '@place': 'place', '@region': 'region', '@realm': 'realm' };
const MENU_KEYS = ['powers', 'scores', 'set', 'clear', 'ladder', 'cast'];
const placeholder = text => (typeof text === 'string' ? text.trim().replace(/^@@/, '@') : text);
const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

function ids(list, ctx, field, known, what) {
    if (!Array.isArray(list) || !list.length || list.length > 100) return ctx.say(field, `${field} must be a non-empty list of ${what} ids.`), false;
    for (const id of list) if (typeof id !== 'string' || !known(id)) ctx.say(field, `"${String(id)}" is not ${what === 'condition' ? 'a condition this pack declares' : `a ${what} id of this pack`} (menus name ids, never display names).`, 'UNKNOWN_REF');
    return true;
}

function pick(entry, ctx, field) {
    if (!whole(entry.pick ?? 1, 1, 8)) ctx.say(`${field}.pick`, `${field}.pick must be a whole number from 1 to 8.`);
}

function delta(entry, ctx, field) {
    const range = entry.delta;
    if (!Array.isArray(range) || range.length !== 2 || !range.every(n => Number.isInteger(n))) return ctx.say(`${field}.delta`, `${field}.delta must be a range of two whole numbers, like [-5, 5].`);
    if (range[0] > range[1]) ctx.say(`${field}.delta`, `${field}.delta [${range}] runs the wrong way (low first).`);
    else if (range[0] < -10 || range[1] > 10) ctx.say(`${field}.delta`, `${field}.delta [${range}] must lie within -10..10.`);
}

function menuEntry(key, entry, ctx, field) {
    if (!isObject(entry)) return ctx.say(field, `${field} must be an object.`);
    const allowed = { powers: ['pick', 'of', 'delta'], scores: ['pick', 'of', 'delta'], set: ['pick', 'of', 'at', 'for'], clear: ['pick', 'of'], ladder: ['of', 'step', 'direction'], cast: ['pick', 'of', 'move'] }[key];
    for (const name of Object.keys(entry)) if (!allowed.includes(name)) ctx.say(`${field}.${name}`, `"${name}" is not a ${key} menu field (expected ${allowed.join(', ')}).`, 'UNKNOWN_FIELD');
    if (key !== 'ladder') pick(entry, ctx, field);
    if (key === 'powers' || key === 'scores') {
        const kind = key === 'powers' ? 'power' : 'score';
        if (!(key === 'powers' && entry.of === 'any')) ids(entry.of, ctx, `${field}.of`, id => ctx.index[kind](id), kind);
        delta(entry, ctx, field);
    } else if (key === 'set' || key === 'clear') {
        ids(entry.of, ctx, `${field}.of`, id => ctx.index.condition(id), 'condition');
        if (key === 'set') {
            const scope = AT[placeholder(entry.at)];
            if (!scope) ctx.say(`${field}.at`, `${field}.at must be "@place", "@region" or "@realm".`);
            else for (const id of Array.isArray(entry.of) ? entry.of : []) { const found = ctx.index.condition(id); if (found && found.scope !== scope) ctx.say(`${field}.of`, `"${id}" is a ${found.scope}-scope condition but the menu sets at ${entry.at}.`); }
            if (!(durationDays(entry.for) > 0)) ctx.say(`${field}.for`, `${field}.for must be a duration, the longest the Director may set (like "10 days").`);
        }
    } else if (key === 'ladder') {
        ids(entry.of, ctx, `${field}.of`, id => ctx.index.condition(id), 'condition');
        if (Array.isArray(entry.of) && entry.of.length < 2) ctx.say(`${field}.of`, `${field}.of must list at least two conditions in order.`);
        if (!whole(entry.step ?? 1, 1, 3)) ctx.say(`${field}.step`, `${field}.step must be a whole number from 1 to 3.`);
        if (entry.direction !== undefined && !['up', 'down', 'either'].includes(entry.direction)) ctx.say(`${field}.direction`, `${field}.direction must be "up", "down" or "either".`);
    } else if (key === 'cast') {
        if (entry.of !== 'figures') {
            if (ids(entry.of, ctx, `${field}.of`, id => ctx.index.person(id) || ctx.index.refused.has(id), 'cast')) {
                for (const id of entry.of) if (ctx.index.person(id)?.protected === true) ctx.collect.warnings.push([`${field}.of`, `"${id}" is a protected person; a generated happening never moves them, so the menu can never pick them.`]);
            }
        }
        if (!AT[placeholder(entry.move)] && !ctx.index.ref(entry.move).size) ctx.say(`${field}.move`, `${field}.move must be "@region", "@place", "@realm" or a place of this pack.`);
    }
}

/** `open: { menu, writes_facts? }`. */
export function checkOpen(open, ctx, field) {
    if (!isObject(open)) return ctx.say(field, `${field} must be { "menu": { … }, "writes_facts": [...] }.`);
    for (const key of Object.keys(open)) if (key !== 'menu' && key !== 'writes_facts') ctx.say(`${field}.${key}`, `"${key}" is not an open field (menu, writes_facts).`, 'UNKNOWN_FIELD');
    if (!isObject(open.menu) || !Object.keys(open.menu).length) ctx.say(`${field}.menu`, `${field}.menu must name at least one pick (${MENU_KEYS.join(', ')}).`);
    else for (const [key, entry] of Object.entries(open.menu)) {
        if (!MENU_KEYS.includes(key)) ctx.say(`${field}.menu.${key}`, `"${key}" is not a menu key (${MENU_KEYS.join(', ')}).`, 'UNKNOWN_FIELD');
        else menuEntry(key, entry, ctx, `${field}.menu.${key}`);
    }
    if (open.writes_facts !== undefined) {
        if (!Array.isArray(open.writes_facts) || open.writes_facts.length > 24 || open.writes_facts.some(id => typeof id !== 'string' || !SLUG.test(id))) ctx.say(`${field}.writes_facts`, `${field}.writes_facts must be a list of fact ids (lower-case-with-hyphens).`);
        else for (const id of open.writes_facts) ctx.collect.facts.add(id);
    }
}

/** `arc: { steps: [low, high] }` (an open template only): a generated arc of 2-4 steps. */
export function checkArc(arc, ctx, field) {
    const steps = isObject(arc) ? arc.steps : null;
    if (!isObject(arc) || Object.keys(arc).some(key => key !== 'steps') || !Array.isArray(steps) || steps.length !== 2 || !steps.every(n => whole(n, 2, 4)) || steps[0] > steps[1]) ctx.say(field, `${field} must be { "steps": [2, 4] } (two whole numbers from 2 to 4, low first).`);
}

/** `per: "region per season"`: how many slots the Director fills: one per <place | region | realm> per <duration>. */
export function checkPer(per, ctx, field) {
    const match = typeof per === 'string' ? /^(place|region|realm) per (.+)$/.exec(per.trim()) : null;
    if (!match || !(durationDays(/^(day|week|month|season|year)$/.test(match[2]) ? `1 ${match[2]}` : match[2]) > 0)) ctx.say(field, `${field} must read like "region per season" or "realm per 2 seasons".`);
}

/** `fallback: { sets?, clears? }`: the fixed effects when the Director fails (the template's own effect keys). */
export function checkFallback(fallback, ctx, field) {
    if (!isObject(fallback) || !Object.keys(fallback).length) return ctx.say(field, `${field} must be { "sets": ["unrest@place: 10 days"] } (sets and/or clears).`);
    for (const key of Object.keys(fallback)) if (key !== 'sets' && key !== 'clears') ctx.say(`${field}.${key}`, `"${key}" is not a fallback field (sets, clears: the template's own effect keys).`, 'UNKNOWN_FIELD');
    for (const [key, duration] of [['sets', 'allow'], ['clears', 'forbid']]) {
        if (fallback[key] === undefined) continue;
        if (!Array.isArray(fallback[key]) || !fallback[key].length) ctx.say(`${field}.${key}`, `${field}.${key} must be a non-empty list.`);
        else fallback[key].forEach((text, n) => {
            const parsed = checkConditionText(text, ctx, `${field}.${key}[${n}]`, { duration });
            if (parsed && key === 'sets' && parsed.duration) ctx.collect.timed.add(parsed.name);
            if (parsed && key === 'clears') ctx.collect.cleared.add(parsed.name);
        });
    }
}
