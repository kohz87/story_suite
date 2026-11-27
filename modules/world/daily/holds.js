// World events, the daily step: conditions with holders (spec v0.10 §2). One entry per `<name>@<ref>` in chronicle.conditions
// (job A's shape) plus, for the step's own writes, `holds` (the events holding it) and `open` (an "until cleared" setter while
// held). An entry ends only when every holder has ended: its timer (`fadesAt`), every event hold, and an open setter.
// A re-set keeps the longer time; a broader condition satisfies a narrower ref inside it, never the reverse; a local clear
// under a broader one masks it there only; a clear at a ref on a day is not undone by a set there the same day. Pure (on `ws`).

import { resolveRef } from './geo.js';
import { ancestors } from './geo-scope.js';
import { entryActive } from './holds-read.js';

const DAY = 1440;
const MAX_CONDITIONS = 64;
const MAX_PER_REF = 8;
const keyOf = (name, ref) => `${name}@${ref}`;

/** An entry's holders: `{ timer (minute or null), open, holds }`. A job-A entry with no end (fadesAt null) is an open setter. */
function partsOf(entry) {
    const holds = Array.isArray(entry.holds) ? [...entry.holds] : [];
    return { timer: entry.fadesAt, open: entry.open === true || (!holds.length && entry.fadesAt === null), holds };
}

/** The stored entry for `parts` over `base`, or null when no holder is left. With no event hold it is job A's plain shape. */
function entryOf(base, { timer, open, holds }) {
    const { holds: _h, open: _o, ...plain } = base;
    if (holds.length) return { ...plain, fadesAt: timer, holds: [...holds].sort(), ...(open ? { open: true } : {}) };
    if (open) return { ...plain, fadesAt: null };
    return timer === null ? null : { ...plain, fadesAt: timer };
}

// A refused set or clear names the condition and ref as the pack wrote them: Problems only.
function note(ws, text) { ws.warnings.push(text); ws.card[text] = ''; return false; }

/**
 * Set `name` at `ref`: `days` (a timer in whole days, at least 1), `null` (until cleared) or `'hold'` (held by `holder` while it is Active).
 * Returns whether it is set. Refused (a warning) for an unknown ref, a full cap, or a clear at that ref earlier today.
 */
export function setCondition(ws, { name, ref, days, holder = null, by, why = '' }, minute) {
    const found = resolveRef(ws.geo, ref);
    if (!found) return note(ws, `${name}@${ref} was not set: "${ref}" is not a place, route, region or realm of this world.`);
    const key = keyOf(name, found.name);
    if (ws.tomb.has(key)) { ws.log.push({ kind: 'kept-clear', key }); return false; }
    const old = ws.table[key];
    if (!old) {
        const all = Object.values(ws.table);
        if (all.length >= MAX_CONDITIONS) return note(ws, `${key} was not set: the world already carries ${MAX_CONDITIONS} conditions.`);
        if (all.filter(entry => entry.ref === found.name).length >= MAX_PER_REF) return note(ws, `${key} was not set: ${found.name} already carries ${MAX_PER_REF} conditions.`);
    }
    const live = entryActive(old, minute);
    const parts = live ? partsOf(old) : { timer: null, open: false, holds: [] };
    if (days === 'hold') { if (holder && !parts.holds.includes(holder)) parts.holds.push(holder); }
    else if (days === null) parts.open = true;
    else parts.timer = Math.max(parts.timer ?? -Infinity, minute + Math.max(1, days) * DAY);
    const base = live ? old : { name, scope: found.kind, ref: found.name, since: minute, why: String(why).slice(0, 200), by, rev: ws.rev };
    const entry = entryOf(base, parts);
    ws.table[key] = entry;
    delete ws.masks[key];
    ws.log.push({ kind: live ? 'still' : 'set', key });
    ws.anchor(`set:${name}`);
    ws.anchor(`set:${name}@${found.name}`);
    return true;
}

/** Clear `name` at `ref` today: the entry goes (every holder with it); under a broader active one, a mask makes it false here only. */
export function clearCondition(ws, name, ref, minute) {
    const found = resolveRef(ws.geo, ref);
    if (!found) return note(ws, `${name}@${ref} was not cleared: "${ref}" is not a place, route, region or realm of this world.`);
    const key = keyOf(name, found.name);
    ws.tomb.add(key);
    const had = entryActive(ws.table[key], minute);
    delete ws.table[key];
    const broader = ancestors(ws.geo, found.name).slice(1).some(level => entryActive(ws.table[keyOf(name, level)], minute));
    if (broader) ws.masks[key] = true;
    if (had || broader) {
        ws.log.push({ kind: 'cleared', key });
        ws.anchor(`cleared:${name}`);
        ws.anchor(`cleared:${name}@${found.name}`);
    }
    return had || broader;
}

/** The event `id` ends, lapses or is replaced: its holds go; an entry with no holder left ends (an open setter keeps it, a timer runs on). */
export function releaseHolds(ws, id, minute) {
    for (const [key, entry] of Object.entries(ws.table).sort(([a], [b]) => (a < b ? -1 : 1))) {
        if (!Array.isArray(entry.holds) || !entry.holds.includes(id)) continue;
        const parts = partsOf(entry);
        parts.holds = parts.holds.filter(each => each !== id);
        const next = entryOf(entry, parts);
        if (next && entryActive(next, minute)) ws.table[key] = next;
        else {
            delete ws.table[key];
            ws.log.push({ kind: 'released', key });
        }
    }
}

/** Timers whose end has come by `minute` (no holder left): removed, in key order. Masks whose broader condition is gone go too. */
export function fadeConditions(ws, minute) {
    for (const key of Object.keys(ws.table).sort()) {
        if (entryActive(ws.table[key], minute)) continue;
        delete ws.table[key];
        ws.log.push({ kind: 'faded', key });
    }
    for (const key of Object.keys(ws.masks).sort()) {
        const [name, ref] = [key.slice(0, key.indexOf('@')), key.slice(key.indexOf('@') + 1)];
        if (!ancestors(ws.geo, ref).slice(1).some(level => entryActive(ws.table[keyOf(name, level)], minute))) delete ws.masks[key];
    }
}
