// World events, the daily step: from the last stepped day to today, one day at a time (spec v0.10 §9 Rolls, Long skips).
// Each day: timers fade, displacements whose condition cleared lapse, the authored events, then the minor templates. The first
// step of a chat starts at today (nothing before it is simulated). A step over more than `longSkip` days says "N world days simulated".
// Input is the stored state and the world; output is the new state, the new conditions table and a report. Pure.

import { seededDraw } from './chance.js';
import { readDefs } from './defs.js';
import { eventsDay } from './events-day.js';
import { buildGeo } from './geo.js';
import { fadeConditions, releaseHolds } from './holds.js';
import { recordAnchor } from './anchors.js';
import { releaseDisplaced } from './cast.js';
import { templatesDay } from './templates-day.js';

const DAY = 1440;
// A step over more days than this shows the long-skip note (seam audit E16: 14, or the reader's longest jump when that is lower; the host passes it).
export const LONG_SKIP = 14;
const MAX_DAYS = 3650;
const list = value => (Array.isArray(value) ? value : []);
const record = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

function people(world) {
    const out = new Map();
    for (const person of list(world.cast)) {
        if (typeof person?.id !== 'string') continue;
        const start = person.start && typeof person.start === 'object' ? person.start.place : person.start;
        out.set(person.id, { id: person.id, name: person.name ?? person.id, protected: person.protected === true, canDieUnmet: person.canDieUnmet !== false, home: person.homeBase ?? start ?? null });
    }
    return out;
}

// Powers and scores are kept by id (v0.13), or by name when an entry has no id; a unique name of an entry with an id finds it too.
function standingsOf(world, saved, names) {
    const out = {};
    const seen = new Map();
    for (const [kind, rows] of [['power', world.powers], ['score', world.scores]]) {
        for (const row of list(rows)) {
            const own = typeof row?.id === 'string' ? row.id : typeof row?.name === 'string' ? row.name : null;
            if (own === null) continue;
            out[`${kind}:${own}`] = Number.isFinite(row.start) ? row.start : 0;
            if (typeof row.id === 'string' && typeof row.name === 'string') {
                const name = `${kind}:${row.name}`;
                seen.set(name, seen.has(name) ? null : `${kind}:${own}`);
            }
        }
    }
    for (const [name, key] of seen) if (key !== null && !(name in out)) names.set(name, key);
    for (const [key, value] of Object.entries(record(saved))) if (key in out && Number.isFinite(value)) out[key] = value;
    return out;
}

/**
 * `runDays({ state, table, world, today, seed, tempo, met, rev, draw?, longSkip? })` → null when there is nothing to step (today was stepped),
 * else `{ daily, conditions, report: { from, to, days, note, log, journal, warnings } }`. `state` is chronicle.daily (or null),
 * `table` chronicle.conditions, `seed` the campaign seed (kept in the state from the first step), `draw` a test's own draw.
 */
export function runDays({ state = null, table = {}, world = {}, today, seed, tempo = 1, met = [], rev = 0, draw = null, longSkip = LONG_SKIP }) {
    if (!Number.isInteger(today)) return null;
    const prior = Number.isInteger(state?.day) ? state.day : null;
    if (prior !== null && today <= prior) return null;
    const campaign = typeof state?.seed === 'string' ? state.seed : String(seed ?? '');
    const paced = Number.isFinite(tempo) && tempo >= 0.25 && tempo <= 4;
    const defs = readDefs(world);
    const ws = {
        geo: buildGeo(world), people: people(world), met: new Set(met), tempo: paced ? tempo : 1, rev,
        declared: new Map(list(world.conditions).filter(row => typeof row?.name === 'string').map(row => [row.name, { name: row.name, scope: row.scope, fades: row.fades ?? null, placeStatus: row.placeStatus === true }])),
        table: { ...record(table) }, masks: { ...record(state?.masks) }, anchors: structuredClone(record(state?.anchors)),
        events: structuredClone(record(state?.events)), lastMajor: { ...record(state?.lastMajor) }, cast: structuredClone(record(state?.cast)),
        standingNames: new Map(), facts: { ...record(state?.facts) }, minors: list(state?.minors).map(entry => ({ ...entry })),
        cooldowns: { ...record(state?.cooldowns) }, startDay: Number.isInteger(state?.start) ? state.start : today,
        draw: draw ?? ((day, key) => seededDraw(campaign, day, key)), warnings: [...defs.warnings, ...(paced ? [] : [`Tempo ${tempo} is outside 0.25-4; tempo 1 is used.`])], log: [], journal: [], tomb: new Set(), day: today,
    };
    ws.standings = standingsOf(world, state?.standings, ws.standingNames);
    // `power:<ref>` / `score:<ref>` in a weight or an effect → the standings key (an id, or a name that is unique).
    ws.standingKey = (kind, ref) => (`${kind}:${ref}` in ws.standings ? `${kind}:${ref}` : ws.standingNames.get(`${kind}:${ref}`) ?? `${kind}:${ref}`);
    ws.anchor = key => recordAnchor(ws.anchors, key, ws.day);
    const first = prior === null ? today : Math.max(prior + 1, today - MAX_DAYS + 1);
    if (prior !== null && first > prior + 1) ws.warnings.push(`${first - prior - 1} days before the last ${MAX_DAYS} were not simulated.`);
    // A hold whose event is not Active here (its step's reply was deleted, or the step's state was lost) would never end: released now.
    const orphans = new Set(Object.values(ws.table).flatMap(entry => entry.holds ?? []).filter(id => ws.events[id]?.state !== 'active'));
    for (const id of [...orphans].sort()) releaseHolds(ws, id, first * DAY);
    for (let day = first; day <= today; day += 1) {
        ws.day = day;
        ws.tomb = new Set();
        fadeConditions(ws, day * DAY);
        releaseDisplaced(ws, null, day * DAY);
        eventsDay(ws, defs.events, day);
        templatesDay(ws, defs.templates, day);
    }
    const days = today - first + 1;
    const daily = {
        seed: campaign, start: ws.startDay, day: today, events: ws.events, anchors: ws.anchors, lastMajor: ws.lastMajor, cast: ws.cast,
        standings: ws.standings, facts: ws.facts, masks: ws.masks, minors: ws.minors, cooldowns: ws.cooldowns,
    };
    return {
        daily, conditions: ws.table,
        report: { from: first, to: today, days, note: days > longSkip ? `${days} world days simulated` : '', log: ws.log, journal: ws.journal, warnings: [...new Set(ws.warnings)] },
    };
}
