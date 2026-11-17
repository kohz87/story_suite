// World events, the daily step: named people moved, changed or killed by code on the tick (spec v0.14.9 §8 Event moves, With You,
// Latest base wins, from, Deaths, Off-screen deaths and moves, Protected cast). Only authored events touch named cast: a template
// never does. A move writes a `displaced` record { to, by, until, routine?, since } and, like a death, leaves a trace: an anchor
// (died:/departed:), a Journal fact and a local rumour at the place they left. Someone with You (party or scene) is not moved: the
// move waits as a `deferred` record (cast-defer.js); a death of someone with You is refused unless the event says even_in_party,
// then it is a `dying` cue for the narrator (never applied off-screen here). A skip by `from` (or by the latest base, ruling 38) goes
// to the step's log (the Inspector), not the Journal. The step keeps this in its own state (`cast`) and reports the moves, releases
// and deaths for the host to mirror into the cast store; NPC State is not written here. Pure (on `ws`).

import { recordAnchor } from './anchors.js';
import { resolveRef } from './geo.js';
import { baseOf, inGroup, placeAt, placeOf } from './cast-where.js';
import { entryActive } from './holds-read.js';

const text = value => (typeof value === 'string' && value.trim() ? value.trim() : '');

/** The trace of a death or a move: the anchor, a Journal line and a rumour where they were. */
export function trace(ws, id, kind, line, from, day, by) {
    recordAnchor(ws.anchors, `${kind}:${id}`, day);
    ws.journal.push({ day, text: line, by });
    if (from) ws.journal.push({ day, text: `Rumour in ${from}: ${line}`, by, rumour: true, place: from });
}

/** Displace `id` to `to` for `by` (the record, the trace, the move for the host). `move`: { until, routine?, title }. */
export function displace(ws, person, to, move, day, by) {
    const row = { ...(ws.cast[person.id] ?? {}) };
    const from = placeOf(ws, person.id);
    row.displaced = { to, by, until: move.until, since: day, ...(move.routine ? { routine: move.routine } : {}) };
    if (move.until === 'permanent') row.home = to;
    delete row.deferred;
    ws.cast[person.id] = row;
    placeAt(ws, person.id, to);
    ws.moves.push({ id: person.id, to, by, until: move.until, routine: move.routine || `staying at ${to} because ${move.title}`, day });
    if (to !== from) trace(ws, person.id, 'departed', move.line ?? `${person.name} left ${from ?? 'home'} for ${to} (${move.title}).`, from, day, by);
}

// Whether a move may touch them by `from` (ruling 35/38): a place id → they are in its group now; "anywhere" → always; none → only
// while their latest base is still their pack start group (nothing moved them since), or the move is the event's own (its on_end
// bringing home someone it displaced).
function fromAllows(ws, person, from, by) {
    if (from === 'anywhere') return true;
    if (from) return inGroup(ws, placeOf(ws, person.id), from);
    const base = baseOf(ws, person.id);
    if (base === null || (person.home && inGroup(ws, base, person.home))) return true;
    return ws.cast[person.id]?.displaced?.by === by;
}

// A named move with no `until` into the group of a place status the same event sets lasts while that status holds (spec §8 staying
// behind, v0.14.8: "she stays at the Terrace for as long as fallen@auvoth holds"), not only while the event is Active.
function statusUntil(ws, source, to) {
    for (const status of Array.isArray(source.statuses) ? source.statuses : []) {
        const place = resolveRef(ws.geo, status.ref);
        if (place?.kind === 'place' && inGroup(ws, to, place.name)) return `cleared:${status.name}@${place.name}`;
    }
    return '';
}

function skip(ws, person, source, day, why) {
    ws.log.push({ kind: 'cast-skipped', key: person.id, by: source.id, day, why });
}

// A death that is not applied: the outcome's line says so ("(<name> survived)", ruling 49) and the Problems note says why (the caller's warning).
function survives(ws, person, source, why) {
    ws.warnings.push(`${source.kind === 'event' ? 'The event' : 'The template'} "${source.id}" would kill ${person.id}, ${why}; ${person.name} survived.`);
    if (Array.isArray(source.survived) && !source.survived.includes(person.name)) source.survived.push(person.name);
}

function die(ws, person, entry, source, day) {
    const row = ws.cast[person.id] ?? {};
    const from = text(entry.from);
    // Ruling 48: a protected person is killed only by an authored event that names them in its effects.cast, never by a template, an open template or the Director.
    if (person.protected && (source.kind !== 'event' || source.open === true)) return survives(ws, person, source, 'who is protected; refused (only an authored event naming them may kill them)');
    if (ws.withYou.has(person.id)) {
        if (source.evenInParty !== true) return survives(ws, person, source, 'who is with You; refused (no even_in_party)');
        if (from && from !== 'anywhere' && !inGroup(ws, placeOf(ws, person.id), from)) return skip(ws, person, source, day, `not in ${from}`);
        ws.cast[person.id] = { ...row, dying: { by: source.id, text: `${person.name} dies here: ${source.summary || source.title}`, day, rev: ws.rev, replies: 0 } };
        ws.log.push({ kind: 'dying', key: person.id, by: source.id, day });
        return;
    }
    if (!ws.met.has(person.id) && person.canDieUnmet === false) {
        return survives(ws, person, source, 'who cannot die before you meet them; skipped');
    }
    if (from && from !== 'anywhere' && !inGroup(ws, placeOf(ws, person.id), from)) return skip(ws, person, source, day, `not in ${from}`);
    const where = placeOf(ws, person.id);
    ws.cast[person.id] = { ...row, died: day };
    ws.deaths.push({ id: person.id, by: source.id, day });
    trace(ws, person.id, 'died', `${person.name} died (${source.title}).`, where, day, source.id);
}

/** Apply an authored event's `effects.cast` entries (source = { kind, id, title, summary?, evenInParty? }). */
export function applyCast(ws, entries, source, day) {
    if (source.kind !== 'event' && source.open !== true) { ws.warnings.push(`The template "${source.id}" names people; templates never touch named cast.`); return; }
    for (const entry of entries) {
        const person = ws.people.get(entry?.who);
        if (!person) { ws.warnings.push(`The event "${source.id}" names "${entry?.who}", who is not in this world's cast.`); continue; }
        if (ws.cast[person.id]?.died !== undefined || ws.cast[person.id]?.dying) continue;
        if (entry.died === true) { die(ws, person, entry, source, day); continue; }
        const location = text(entry.location);
        const from = text(entry.from);
        if (location) {
            if (!fromAllows(ws, person, from, source.id)) { skip(ws, person, source, day, from ? `not in ${from}` : 'moved from their start since'); continue; }
            const to = resolveRef(ws.geo, location)?.name ?? location;
            const move = { until: text(entry.until) || statusUntil(ws, source, to) || 'end', routine: text(entry.routine), title: source.title };
            if (ws.withYou.has(person.id)) {
                // With You: not moved; the move waits until they part from You (cast-defer.js), `from` checked again then.
                ws.cast[person.id] = { ...(ws.cast[person.id] ?? {}), deferred: { to, by: source.id, until: move.until, title: source.title, ...(move.routine ? { routine: move.routine } : {}), ...(from ? { from } : {}) } };
                ws.journal.push({ day, text: `${person.name} stays with You — ${source.title}`, by: source.id, withYou: true });
                continue;
            }
            displace(ws, person, to, move, day, source.id);
        }
        const row = { ...(ws.cast[person.id] ?? {}) };
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
        ws.released.push({ id, by: displaced.by, to: displaced.to });
    }
}
