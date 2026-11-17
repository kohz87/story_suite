// World events, the daily step: an event fires (outcome picked, effects applied: event-level first, then the outcome's) and
// ends (on_end applied, its holds and displacements released). Lapsed or Replaced events end too, without on_end. Pure (on `ws`).

import { recordAnchor } from './anchors.js';
import { applyEffects, runEvacuations } from './effects.js';
import { releaseHolds } from './holds.js';
import { releaseDisplaced } from './cast.js';

const DAY = 1440;

/** Outcome weight: a number (≥ 0), or `power:<id or name>` / `score:<id or name>` → the live standing + 100, clamped to at least 0. */
function weightOf(ws, weight) {
    if (typeof weight === 'number') return Math.max(0, weight);
    const match = typeof weight === 'string' ? /^(power|score):(.+)$/.exec(weight.trim()) : null;
    const value = match ? ws.standings[ws.standingKey(match[1], match[2].trim())] : undefined;
    return Number.isFinite(value) ? Math.max(0, value + 100) : 0;
}

/** The chosen outcome (one is certain; none written → none), from the seeded draw `${id}#outcome`. */
export function pickOutcome(ws, def, day) {
    const list = def.outcomes ?? [];
    if (!list.length) return null;
    const weights = list.map(outcome => weightOf(ws, outcome.weight));
    const total = weights.reduce((a, b) => a + b, 0);
    const used = total > 0 ? weights : weights.map(() => 1);
    let at = ws.draw(day, `${def.id}#outcome`) * (total > 0 ? total : list.length);
    for (let index = 0; index < list.length; index += 1) {
        if (at < used[index]) return list[index];
        at -= used[index];
    }
    return list[list.length - 1];
}

const fill = (text, outcome, bind) => String(text ?? '').replace(/\{outcome\}/g, outcome?.name ?? '').replace(/\{place\}/g, bind?.place ?? '').replace(/\{region\}/g, bind?.region ?? bind?.place ?? '').replace(/\{realm\}/g, bind?.realm ?? '').replace(/\s+/g, ' ').trim();

/** The event fires on `day` (bound to `bind` for a recurring one, taking slots in `realms`). An instant event ends the same day. */
export function fireEvent(ws, def, day, bind, realms) {
    const row = ws.events[def.id];
    const outcome = pickOutcome(ws, def, day);
    Object.assign(row, { state: 'active', fired: day, realms, major: def.severity === 'major' });
    if (outcome) row.outcome = outcome.name; else delete row.outcome;
    if (bind?.place) { row.bind = bind; row.places = { ...(row.places ?? {}), [bind.place]: day }; } else delete row.bind;
    recordAnchor(ws.anchors, `fired:${def.id}`, day);
    const summary = fill(outcome?.summary ? `${fill(def.summary, outcome, bind)} ${outcome.summary}` : def.summary, outcome, bind);
    const source = { kind: 'event', id: def.id, title: def.title, held: true, summary, evenInParty: def.evenInParty === true };
    const { on_end: _end, ...main } = def.effects ?? {};
    // Named moves of both blocks apply before the event's evacuations (ruling 39: someone a named move placed is exempt).
    const evac = [];
    applyEffects(ws, main, source, day, bind, evac);
    if (outcome?.effects) { const { on_end: _o, ...rest } = outcome.effects; applyEffects(ws, rest, source, day, bind, evac); }
    runEvacuations(ws, evac);
    // `where` and `title` let the host write the happening as news from where it happened (world-daily/news-entries.js).
    ws.journal.push({ day, text: summary, by: def.id, fired: true, reach: def.reach, title: def.title, where: def.where?.refs ?? [], ...(bind?.place ? { place: bind.place } : {}) });
    if (def.ends?.instant) endEvent(ws, def, day);
}

/** The event Ends on `day`: on_end (the event's, then the outcome's), holds released, displacements by it lapse. Recurring events wait again. */
export function endEvent(ws, def, day) {
    const row = ws.events[def.id];
    const bind = row.bind ?? {};
    const outcome = (def.outcomes ?? []).find(each => each.name === row.outcome);
    recordAnchor(ws.anchors, `ended:${def.id}`, day);
    const source = { kind: 'event', id: def.id, title: def.title, held: false, summary: fill(def.summary, outcome, bind), evenInParty: def.evenInParty === true };
    const evac = [];
    applyEffects(ws, def.effects?.on_end, source, day, bind, evac);
    applyEffects(ws, outcome?.effects?.on_end, source, day, bind, evac);
    runEvacuations(ws, evac);
    releaseHolds(ws, def.id, day * DAY);
    releaseDisplaced(ws, def.id, day * DAY);
    Object.assign(row, { state: def.kind === 'recurring' ? 'dormant' : 'ended', ended: day });
    delete row.realms;
    ws.journal.push({ day, text: `Ended: ${fill(def.summary, outcome, bind)}`, by: def.id, ended: true, reach: def.reach });
}

/** The event Lapses or is Replaced on `day` (terminal; on_end does not apply). */
export function closeEvent(ws, def, day, state, why = '') {
    const row = ws.events[def.id];
    Object.assign(row, { state, closed: day });
    if (state === 'lapsed') recordAnchor(ws.anchors, `lapsed:${def.id}`, day);
    releaseHolds(ws, def.id, day * DAY);
    releaseDisplaced(ws, def.id, day * DAY);
    ws.log.push({ kind: state, key: def.id, day, ...(why ? { why } : {}) });
}
