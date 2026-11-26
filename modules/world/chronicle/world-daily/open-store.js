// World events, open templates on the host (spec §9): the Director's answers reach the chat through one command, `chronicle.world.open`,
// run in beforeGenerate (the message before the reply, so a swipe, delete or Re-read of the reply never takes a stored answer away, as the
// campaign seed). It writes the answers and the call count into the ledger. The hooks also start the asking ahead of time: for the slots
// waiting and for the slots tomorrow's roll will make (a dry run of the step), never awaited, so no reply waits for a call. The dry run after a
// reply starts from the state the reply's own step left (afterReceive), so a long skip's days are stepped once, not twice (perf PB9, L1).
// The daily step reads only what is stored: an answer that is not stored when the day crosses leaves the slot waiting (settled after the
// reply that stores it). Everything here is off with the world-events switch.

import { slotValue } from '../../../rpg/slot.js';
import { worldEventsOn, WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { ledgerOf, storeOpen } from '../conditions/ledger.js';
import { yearOf } from '../conditions/director-calls.js';
import { calendarFrom, nowFrom } from '../queries.js';
import { runDays } from '../../daily/step.js';
import { isWorldSeed } from './seed.js';
import { readWorld } from './read-world.js';
import { openAsker, scopeOf } from './open-ask.js';
import { tempoOf } from './tempo.js';
import { tickInputs } from './cast-tie.js';
import { partyRegionOf } from './party-region.js';
import { ask as askQuery } from '../queries-parts/shared-ask.js';

export const OPEN = 'chronicle.world.open';
const DAY = 1440;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const OUTCOMES = new Set(['ok', 'retry', 'fallback']);

function store(ctx, payload = {}) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'The Director\'s answers for open templates are stored by code before a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const results = isRecord(payload.results) ? payload.results : {};
    const bad = Object.entries(results).some(([key, row]) => !key.includes('|') || !isRecord(row) || !OUTCOMES.has(row.outcome) || (row.answer !== undefined && (typeof row.answer !== 'string' || row.answer.length > 7000)) || (row.why !== undefined && typeof row.why !== 'string'));
    if (bad || !Number.isInteger(payload.calls ?? 0) || (payload.calls ?? 0) < 0) return ctx.fail('INVALID', 'The stored answers are not in the form the world reads.');
    const query = typeof ctx.query === 'function' ? (name, args) => ctx.query(name, args) : null;
    storeOpen(ctx.draft('chronicle'), { results, calls: payload.calls ?? 0, year: yearOf(calendarFrom(query), nowFrom(query, { domains: { director: ctx.draft('director') } })) });
    return { summary: '', narrate: false, data: { stored: Object.keys(results).length, calls: payload.calls ?? 0 } };
}

/** The command, tagged with the feature (refused while the switch is off) and internal (never from a click or the sdk). */
export const openCommand = Object.assign(store, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(openCommand, 'internal', { value: true, enumerable: true });

/**
 * What the asking side needs from a hook's view, or null: the world has an open template, the step has started, the clock is set. It carries what
 * the daily step itself is given (command.js): the reader's tempo, the calendar, the party's region and the cast tie (who is with You, where each
 * pack person is, who has been met), so the look-ahead makes the slots the step will make and no call is asked for a slot that never happens (final review M1).
 */
function inputOf(view) {
    const chronicle = view?.state?.domains?.chronicle;
    const state = slotValue(chronicle?.daily);
    const minutes = view?.state?.domains?.director?.time?.minutes;
    if (!state || !Number.isInteger(minutes) || typeof view.query !== 'function') return null;
    const world = readWorld((name, args) => view.query(name, args));
    if (!world.templates.some(raw => raw && typeof raw === 'object' && raw.open !== undefined)) return null;
    const marks = ledgerOf(chronicle.ledger);
    const seed = state.seed ?? (isWorldSeed(chronicle.worldSeed) ? chronicle.worldSeed : '');
    const query = (name, args) => view.query(name, args);
    const tie = tickInputs({ query }, view.state.domains.cast, world.cast);
    const tempo = tempoOf(typeof view.settings === 'function' ? view.settings() : view.settings);
    return { state, table: chronicle.conditions ?? {}, world, seed, marks, opens: marks.open, minutes, tempo, calendar: askQuery(query, 'director.calendar', {}), met: tie.met, withYou: tie.withYou, positions: tie.positions, partyRegion: partyRegionOf(query, view.state) };
}

/** Starts the asking for the slots waiting and the ones tomorrow's roll makes (a dry run: nothing is written). Never awaits. Returns the keys of those slots. */
function ask(view, input) {
    const { state, table, world, seed, marks, opens, tempo, calendar, met, withYou, positions, partyRegion } = input;
    const dry = runDays({ state, table, world, today: Math.floor(input.minutes / DAY) + 1, seed, marks, opens, tempo, calendar, met, withYou, positions, partyRegion });
    const slots = dry?.daily.pending ?? input.state.pending ?? [];
    if (slots.length) openAsker.kick(view, input, slots);
    return new Set(slots.map(slot => slot.key));
}

/** beforeGenerate: ask ahead, then the store command for the answers that are ready (none when nothing is ready). */
export function openBeforeGenerate(view) {
    if (!worldEventsOn(view)) return [];
    const input = inputOf(view);
    if (!input) return [];
    const wanted = ask(view, input);
    const ready = openAsker.drain(scopeOf(view, input.seed), input.opens?.results ?? {}, wanted);
    return ready ? [{ type: OPEN, payload: ready }] : [];
}

/** afterReceive (a reply has arrived and its steps have run): ask ahead from the state the reply's step left, one day on. Never awaits. */
export function openAfterReceive(view) {
    if (!worldEventsOn(view)) return;
    const input = inputOf(view);
    if (input) ask(view, input);
}
