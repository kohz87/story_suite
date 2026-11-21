// The daily roll's events the Director may judge (switch story-director.world-events): a dry run of tomorrow's step (nothing is written) from the
// state a hook sees, as the open templates' look-ahead does. `fires`: the likely or possible authored events tomorrow's roll fires; `all`: every
// such event eligible tomorrow (the optional daily pass). Set-in-motion events are never judged (certain inside their window). Pure on the view.

import { slotValue } from '../../../rpg/slot.js';
import { ledgerOf } from '../conditions/ledger.js';
import { runDays } from '../../daily/step.js';
import { readDefs } from '../../daily/defs.js';
import { isWorldSeed } from '../world-daily/seed.js';
import { readWorld } from '../world-daily/read-world.js';
import { tickInputs } from '../world-daily/cast-tie.js';
import { tempoOf } from '../world-daily/tempo.js';
import { ask as askQuery } from '../queries-parts/shared-ask.js';

const DAY = 1440;
const MAX = 6;
const fill = (text, bind) => String(text ?? '').replace(/\{outcome\}/g, '').replace(/\{place\}/g, bind?.place ?? '').replace(/\{region\}/g, bind?.regionName ?? bind?.region ?? bind?.place ?? '').replace(/\{realm\}/g, bind?.realm ?? '').replace(/\s+/g, ' ').trim();

/**
 * `{ day, items: [{ id, title, summary, place, certainty, fires }] }` for tomorrow (`all`: every likely/possible event eligible then, else only those
 * its roll fires), at most six, or null (the step has not started, the clock is not set, nothing to judge). `settings`: the chronicle's (its tempo).
 */
export function rollCandidates(view, { all = false, settings = null } = {}) {
    const chronicle = view?.state?.domains?.chronicle;
    const state = slotValue(chronicle?.daily);
    const minutes = view?.state?.domains?.director?.time?.minutes;
    if (!state || !Number.isInteger(minutes) || typeof view.query !== 'function') return null;
    const query = (name, args) => view.query(name, args);
    const world = readWorld(query);
    const { events } = readDefs(world);
    const judged = events.filter(def => def.certainty !== 'set-in-motion');
    if (!judged.length) return null;
    const day = Math.floor(minutes / DAY) + 1;
    const marks = ledgerOf(chronicle.ledger);
    const tie = tickInputs({ query }, view.state.domains.cast, world.cast);
    let dry = null;
    try {
        dry = runDays({ state, table: chronicle.conditions ?? {}, world, today: day, seed: state.seed ?? (isWorldSeed(chronicle.worldSeed) ? chronicle.worldSeed : ''), marks, opens: marks.open, tempo: tempoOf(settings), calendar: askQuery(query, 'director.calendar', {}), met: tie.met, withYou: tie.withYou, positions: tie.positions });
    } catch { dry = null; }
    const rows = dry?.daily?.events;
    if (!rows) return null;
    const items = judged.map(def => {
        const row = rows[def.id] ?? {};
        const fires = row.fired === day && state.events?.[def.id]?.state !== 'active';
        const open = fires || row.state === 'eligible';
        return open && (all || fires) ? { id: def.id, title: String(def.title ?? def.id), summary: fill(def.summary, row.bind), place: String(row.bind?.place ?? (Array.isArray(def.where?.refs) ? def.where.refs.slice(0, 2).join(', ') : '')), certainty: def.certainty, fires } : null;
    }).filter(Boolean).slice(0, MAX);
    return items.length ? { day, items } : null;
}
