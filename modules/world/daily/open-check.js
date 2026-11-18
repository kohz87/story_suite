// World events, open templates (spec §5 "What code checks"): a Director's answer for a slot checked against the template's menu and the
// guards: every ref exists, every pick is inside the menu, no protected person or place, no condition an authored event reads (unless
// marked `open: true`), a fact only through `writes_facts`. All errors are returned (the retry sends them back). Pure on `ws`.

import { durationDays } from './durations.js';
import { conditionHolds } from './holds-read.js';
import { resolveRef } from './geo.js';
import { protectedHere } from './protected-here.js';

const DAY = 1440;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => (Array.isArray(value) ? value : []);
const cut = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function standings(ws, kind, menu, raw, errors, out) {
    if (raw === undefined) return;
    if (!menu) { errors.push(`effects.${kind}s is not in this template's menu.`); return; }
    if (!isRecord(raw) || Object.keys(raw).length > menu.pick) errors.push(`effects.${kind}s may move at most ${menu.pick}.`);
    for (const [id, delta] of Object.entries(isRecord(raw) ? raw : {})) {
        if (!(`${kind}:${id}` in ws.standings)) errors.push(`The ${kind} "${id}" is not in this world (use an id).`);
        else if (menu.of !== 'any' && !menu.of.includes(id)) errors.push(`The ${kind} "${id}" is not in the menu.`);
        if (!Number.isInteger(delta) || delta < menu.delta[0] || delta > menu.delta[1]) errors.push(`The ${kind} "${id}" must move by a whole number from ${menu.delta[0]} to ${menu.delta[1]}.`);
        else out[id] = delta;
    }
}

/** A written condition name → its declared row, or an error text (not declared, authored-read and not open, or a place status on a protected person's place). */
function writable(ws, def, name, bind) {
    const row = ws.declared.get(name);
    if (!row) return { why: `The condition "${name}" is not one of this world's conditions.` };
    if (ws.reads.conds.has(name) && row.open !== true) return { why: `The condition "${name}" is read by an authored event; the Director may not write it.` };
    if (row.placeStatus === true) {
        const places = row.scope === 'place' ? [bind.place] : ws.geo.places.filter(place => (row.scope === 'region' ? place.region === bind.region : place.realm === bind.realm)).map(place => place.name);
        if (places.some(place => protectedHere(ws, { name: place }))) return { why: `The condition "${name}" would fall on a place where a protected person lives.` };
    }
    return { row };
}

const refOf = row => `@${row.scope}`;

function conditions(ws, def, menu, answer, bind, errors, out) {
    const sets = answer.set === undefined ? [] : answer.set;
    const clears = answer.clear === undefined ? [] : answer.clear;
    if (sets.length && !menu.set) errors.push('effects.set is not in this template\'s menu.');
    if (clears.length && !menu.clear) errors.push('effects.clear is not in this template\'s menu.');
    if (!Array.isArray(sets) || (menu.set && sets.length > menu.set.pick)) errors.push(`effects.set may name at most ${menu.set?.pick ?? 0}.`);
    if (!Array.isArray(clears) || (menu.clear && clears.length > menu.clear.pick)) errors.push(`effects.clear may name at most ${menu.clear?.pick ?? 0}.`);
    if (!menu.set && !menu.clear) return;
    for (const item of Array.isArray(sets) ? sets : []) {
        const name = typeof item === 'string' ? item : item?.condition;
        if (menu.set && !menu.set.of.includes(name)) { errors.push(`The condition "${name}" is not in the set menu.`); continue; }
        const found = writable(ws, def, name, bind);
        if (found.why) { errors.push(found.why); continue; }
        if (found.row.scope !== menu.set.at) { errors.push(`The condition "${name}" has scope ${found.row.scope}, not ${menu.set.at}.`); continue; }
        const text = typeof item === 'object' && item?.for ? String(item.for) : null;
        const days = text === null ? undefined : durationDays(text, { open: true });
        if (text !== null && (days === undefined || (menu.set.for !== null && (days === null || days > menu.set.for)))) { errors.push(`The duration "${text}" for "${name}" is longer than the menu allows.`); continue; }
        out.set.push(`${name}${refOf(found.row)}${text ? `: ${text}` : ''}`);
    }
    for (const name of Array.isArray(clears) ? clears : []) {
        if (!menu.clear?.of.includes(name)) { errors.push(`The condition "${name}" is not in the clear menu.`); continue; }
        const found = writable(ws, def, name, bind);
        if (found.why) errors.push(found.why);
        else out.clear.push(`${name}${refOf(found.row)}`);
    }
}

function ladder(ws, menu, raw, bind, day, errors, out) {
    if (raw === undefined) return;
    if (!menu) { errors.push('effects.ladder is not in this template\'s menu.'); return; }
    const direction = raw?.direction;
    const steps = raw?.steps === undefined ? 1 : raw.steps;
    if (!['up', 'down'].includes(direction) || (menu.direction !== 'either' && menu.direction !== direction)) { errors.push(`The ladder moves ${menu.direction === 'either' ? 'up or down' : menu.direction}.`); return; }
    if (!Number.isInteger(steps) || steps < 1 || steps > menu.step) { errors.push(`The ladder moves at most ${menu.step} step(s), never a jump.`); return; }
    const rows = menu.of.map(name => ws.declared.get(name));
    if (rows.some(row => !row) || new Set(rows.map(row => row.scope)).size !== 1) { errors.push('The ladder names conditions that are not all declared at one scope.'); return; }
    const ref = bind[rows[0].scope];
    const held = menu.of.findLastIndex(name => ref && conditionHolds(ws, name, ref, day * DAY));
    const to = held + (direction === 'up' ? steps : -steps);
    if (to < 0 || to >= menu.of.length) { errors.push('The ladder has no rung that way from where the front stands.'); return; }
    for (const name of [held >= 0 ? menu.of[held] : null, menu.of[to]].filter(Boolean)) {
        const found = writable(ws, {}, name, bind);
        if (found.why) { errors.push(found.why); return; }
    }
    if (held >= 0) out.clear.push(`${menu.of[held]}${refOf(rows[0])}`);
    out.set.push(`${menu.of[to]}${refOf(rows[0])}`);
}

function movers(ws, menu, raw, bind, errors, out) {
    if (raw === undefined) return;
    if (!menu) { errors.push('effects.cast is not in this template\'s menu.'); return; }
    if (!Array.isArray(raw) || raw.length > menu.pick) errors.push(`effects.cast may move at most ${menu.pick}.`);
    for (const item of list(raw)) {
        const person = ws.people.get(item?.id);
        const place = resolveRef(ws.geo, item?.to);
        if (!person || person.protected || person.kind !== 'figure' || (menu.of !== 'figures' && !menu.of.includes(person.id))) errors.push(`"${item?.id}" is not a figure the menu lets move.`);
        else if (place?.kind !== 'place' || place.place.region !== bind.region) errors.push(`"${item?.to}" is not a place in ${bind.region}.`);
        else out.cast.push({ who: person.id, location: place.name });
    }
}

/**
 * `checkOpen(ws, def, bind, answer, day)` → `{ errors, name, summary, people, block }`. `block` is an effects block for applyEffects:
 * `{ set, clear, powers, scores, facts, cast }`. With errors the block must not be used.
 */
export function checkOpen(ws, def, bind, answer, day) {
    const errors = [];
    const menu = def.open.menu;
    const effects = isRecord(answer?.effects) ? answer.effects : {};
    const name = cut(answer?.name, 80);
    const summary = cut(answer?.summary, 300);
    if (!name || !summary) errors.push('The answer needs a name and a summary.');
    for (const key of Object.keys(effects)) if (!['powers', 'scores', 'set', 'clear', 'ladder', 'cast', 'fact'].includes(key)) errors.push(`effects.${key} is not something a template can do.`);
    const block = { set: [], clear: [], powers: {}, scores: {}, facts: [], cast: [] };
    standings(ws, 'power', menu.powers, effects.powers, errors, block.powers);
    standings(ws, 'score', menu.scores, effects.scores, errors, block.scores);
    conditions(ws, def, menu, effects, bind, errors, block);
    ladder(ws, menu.ladder, effects.ladder, bind, day, errors, block);
    movers(ws, menu.cast, effects.cast, bind, errors, block);
    if (effects.fact !== undefined) {
        if (!def.open.facts.includes(effects.fact)) errors.push(`The fact "${effects.fact}" is not in writes_facts.`);
        else block.facts.push({ id: effects.fact, text: summary });
    }
    const people = list(answer?.people);
    for (const id of people) if (!ws.people.has(id) || ws.people.get(id).protected) errors.push(`"${id}" is not a person the happening may name.`);
    return { errors: [...new Set(errors)].slice(0, 10), name, summary, people: people.filter(id => ws.people.has(id) && !ws.people.get(id).protected).slice(0, 6), block };
}
