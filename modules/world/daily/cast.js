// World events, the daily step: named people moved, changed or killed by code on the tick (spec v0.10 §8 Event moves,
// Off-screen deaths and moves, Protected cast; §2 placeStatus evacuation). Only authored events touch named cast: a template
// never does. A death of an unmet person with canDieUnmet false is skipped (a warning). A move writes a `displaced` record
// { to, by, until, routine? } and, like a death, leaves a trace: an anchor (died:/departed:), a Journal fact and a local
// rumour at the place they left. The step keeps this in its own state (`cast`); NPC State is not written here. Pure (on `ws`).

import { recordAnchor } from './anchors.js';
import { resolveRef } from './geo.js';
import { entryActive } from './holds-read.js';

const DAY = 1440;

/** Where a person is now by the step's record: displaced place, else home (permanent moves), else the pack's start/home base. */
export function placeOf(ws, id) {
    const row = ws.cast[id] ?? {};
    return row.displaced?.to ?? row.home ?? ws.people.get(id)?.home ?? null;
}

function trace(ws, id, kind, text, from, day, by) {
    recordAnchor(ws.anchors, `${kind}:${id}`, day);
    ws.journal.push({ day, text, by });
    if (from) ws.journal.push({ day, text: `Rumour in ${from}: ${text}`, by, rumour: true, place: from });
}

/** Apply an authored event's `effects.cast` entries (source = { kind, id, title }). */
export function applyCast(ws, entries, source, day) {
    if (source.kind !== 'event') { ws.warnings.push(`The template "${source.id}" names people; templates never touch named cast.`); return; }
    for (const entry of entries) {
        const person = ws.people.get(entry?.who);
        if (!person) { ws.warnings.push(`The event "${source.id}" names "${entry?.who}", who is not in this world's cast.`); continue; }
        const row = { ...(ws.cast[person.id] ?? {}) };
        if (row.died !== undefined) continue;
        const from = placeOf(ws, person.id);
        if (entry.died === true) {
            if (!ws.met.has(person.id) && person.canDieUnmet === false) {
                ws.warnings.push(`The event "${source.id}" would kill ${person.id}, who cannot die before you meet them; skipped.`);
            } else {
                row.died = day;
                ws.cast[person.id] = row;
                trace(ws, person.id, 'died', `${person.name} died (${source.title}).`, from, day, source.id);
                continue;
            }
        }
        if (typeof entry.location === 'string' && entry.location.trim()) {
            const to = resolveRef(ws.geo, entry.location)?.name ?? entry.location.trim();
            const until = typeof entry.until === 'string' && entry.until.trim() ? entry.until.trim() : 'end';
            row.displaced = { to, by: source.id, until, ...(typeof entry.routine === 'string' && entry.routine.trim() ? { routine: entry.routine.trim() } : {}) };
            if (until === 'permanent') row.home = to;
            if (to !== from) trace(ws, person.id, 'departed', `${person.name} left ${from ?? 'home'} for ${to} (${source.title}).`, from, day, source.id);
        }
        if (typeof entry.status === 'string') row.status = entry.status.slice(0, 200);
        if (typeof entry.goal === 'string') row.goal = entry.goal.slice(0, 200);
        if (Object.keys(row).length) ws.cast[person.id] = row;
    }
}

/** Displacements that end: those `by` an event that ended (until "end"), and "cleared:<condition>@<ref>" ones whose condition is gone. */
export function releaseDisplaced(ws, eventId, minute) {
    for (const id of Object.keys(ws.cast).sort()) {
        const shown = ws.cast[id].displaced;
        if (!shown || shown.until === 'permanent') continue;
        const byEvent = eventId !== null && shown.by === eventId && shown.until === 'end';
        const cleared = shown.until.startsWith('cleared:') && !entryActive(ws.table[shown.until.slice('cleared:'.length)], minute);
        if (!byEvent && !cleared) continue;
        const { displaced, ...rest } = ws.cast[id];
        ws.cast[id] = rest;
    }
}

/**
 * A placeStatus condition was set on `ref` (a place): everyone living there moves to the nearest suitable place (not class none,
 * not under a placeStatus itself), else the nearest place of any kind; ties by place id. An authored event moves protected
 * people too; a template does not (it is refused at load; here it is a warning and they stay).
 */
export function evacuate(ws, ref, condition, source, day) {
    const found = resolveRef(ws.geo, ref);
    if (found?.kind !== 'place') return;
    const here = found.place;
    const residents = [...ws.people.values()].filter(person => ws.cast[person.id]?.died === undefined && placeOf(ws, person.id) === here.name);
    if (!residents.length) return;
    const masked = place => [...ws.declared.values()].some(entry => entry.placeStatus === true && entryActive(ws.table[`${entry.name}@${place.name}`], day * DAY));
    const near = list => list.map(place => ({ place, d: (place.x - here.x) ** 2 + (place.y - here.y) ** 2 })).sort((a, b) => a.d - b.d || (a.place.id < b.place.id ? -1 : 1))[0]?.place;
    const others = ws.geo.places.filter(place => place !== here);
    const to = near(others.filter(place => place.klass !== 'none' && !masked(place))) ?? near(others);
    if (!to) return;
    for (const person of residents) {
        if (person.protected && source.kind !== 'event') { ws.warnings.push(`${person.id} is protected and stays at ${here.name} (a template cannot move them).`); continue; }
        const row = { ...(ws.cast[person.id] ?? {}) };
        row.displaced = { to: to.name, by: source.id, until: `cleared:${condition}@${here.name}` };
        ws.cast[person.id] = row;
        trace(ws, person.id, 'departed', `${person.name} fled ${here.name} for ${to.name} (${condition}).`, here.name, day, source.id);
    }
}
