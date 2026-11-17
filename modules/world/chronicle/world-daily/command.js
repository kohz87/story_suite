// World events, the daily step on the host: the `chronicle.world.daily` command (world-events switch). Run by code after a reply's
// lines (afterCapture) when the story day has changed since the last step: it steps every day from the last stepped one to today (spec v0.10 §9) and
// writes the results into the chronicle (`daily`, the step's state as a slot written whole, and `conditions`). The changes are recorded in the reply that
// carries the step, so replay applies them and never rolls again. Its card lists what fired, ended and lapsed, the long-skip note
// and every warning. The first step of a chat starts at today with the campaign seed minted before the first reply (seed.js; drawn here only when there is none) and keeps it in its state.

import { revOf } from '../domain-parts/lookup.js';
import { slotValue, toSlot } from '../../../rpg/slot.js';
import { clockOf } from '../capture/text.js';
import { pointerOf } from '../conditions/key.js';
import { worldEventsOn } from '../capture/world-parts/switch.js';
import { WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { LONG_SKIP, runDays } from '../../daily/step.js';
import { maxJumpMinutes, settingsFrom } from '../../../time/tracker/time.js';
import { readWorld } from './read-world.js';
import { tempoOf } from './tempo.js';
import { dailySummary } from './summary.js';
import { isWorldSeed } from './seed.js';
import { ledgerOf, markLedger } from '../conditions/ledger.js';
import { writeHappenings } from './news-entries.js';
import { buildGeo } from '../../daily/geo.js';
import { calendarFrom, dateText } from '../queries-parts/clock.js';
import { mirrorCast, tickInputs } from './cast-tie.js';

export const DAILY = 'chronicle.world.daily';
const DAY = 1440;

function newSeed(ctx) {
    let out = '';
    for (let i = 0; i < 16; i += 1) out += Math.floor((typeof ctx.rng === 'function' ? ctx.rng() : 0) * 16).toString(16);
    return out;
}

/**
 * The conditions table becomes `next`. A key an earlier reply made that this step removes or changes is marked ctx.ifThere: on replay
 * after that reply is deleted the change is passed over (the entry is not there to change), and the rest of the step still applies.
 */
function writeConditions(ctx, chronicle, next) {
    const table = chronicle.conditions ?? {};
    const mark = key => { if (typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', pointerOf(key)); };
    for (const key of Object.keys(table).sort()) {
        if (key in next) continue;
        mark(key);
        delete table[key];
    }
    for (const key of Object.keys(next).sort()) {
        if (JSON.stringify(table[key]) === JSON.stringify(next[key])) continue;
        if (key in table) mark(key);
        table[key] = next[key];
    }
    if (Object.keys(table).length || chronicle.conditions) chronicle.conditions = table;
}

/**
 * A Re-read's warning (seam audit E21): the events the reply's old step fired or had lost (`payload.before.fired`, the hook) that this
 * step does not fire, as `{ ids, text }`. Later replies keep what they recorded, so a later firing that needed one keeps its record;
 * the reader is told. The ids stay in the receipt's `data.lost`, so a second Re-read still warns.
 */
function lostOf(payload, fired) {
    const ids = (Array.isArray(payload?.before?.fired) ? payload.before.fired : []).filter(id => typeof id === 'string' && !fired.includes(id));
    if (!ids.length) return { ids, text: '' };
    return { ids, text: `World: after this edit ${ids.slice(0, 6).join(', ')} no longer fired on this reply's days; the later replies keep what they recorded (a later event that needed it is not undone).` };
}

// The cast store's draft (Story Director's own domain), or null when the cast part is not there.
function draftCast(ctx) {
    try { return ctx.draft('cast'); } catch { return null; }
}

function daily(ctx, payload = {}) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'The world steps its days only when code checks the clock before a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const now = clockOf(ctx);
    if (now === null) return ctx.fail('NOT_YET', 'The story has no date yet; the world waits for one.');
    const chronicle = ctx.draft('chronicle');
    const state = slotValue(chronicle.daily);
    const today = Math.floor(now / DAY);
    // A shrunk Re-read or a rewind can leave the last stepped day ahead of the clock: nothing is stepped again or undone.
    const kept = () => {
        const lost = lostOf(payload, []);
        return { summary: lost.text, narrate: false, data: { days: 0, ...(lost.ids.length ? { lost: lost.ids } : {}) }, ...(lost.text ? { problem: lost.text } : {}) };
    };
    if (state && today <= state.day) return kept();
    // The long-skip note shows above 14 stepped days, or above the reader's longest jump when that is lower (seam audit E16; the time part's setting, read through `settings.reads`).
    const longSkip = Math.min(LONG_SKIP, maxJumpMinutes(settingsFrom(ctx.settings)) / DAY);
    const seed = state?.seed ?? (isWorldSeed(chronicle.worldSeed) ? chronicle.worldSeed : newSeed(ctx));
    const marks = ledgerOf(chronicle.ledger);
    const query = (name, args) => ctx.query(name, args);
    const world = readWorld(query);
    // Who is with You, where each pack person is and who has been met, from the cast store, the party and the scene (cast-tie.js).
    const cast = draftCast(ctx);
    const tie = tickInputs(ctx, cast, world.cast);
    const out = runDays({ state, table: chronicle.conditions ?? {}, world, today, seed, tempo: tempoOf(typeof ctx.settings === 'function' ? ctx.settings() : ctx.settings), rev: revOf(ctx), longSkip, marks, met: tie.met, withYou: tie.withYou, positions: tie.positions });
    if (!out) return kept();
    if (cast) mirrorCast(ctx, cast, out.report, tie.keys, now);
    writeConditions(ctx, chronicle, out.conditions);
    // The ledger's anchors are now the step's own; today's clears stay in its tomb (spec §2 clear beats set, also against a later world line today).
    markLedger(chronicle, { day: today, take: true, tombKeys: out.report.tomb, reset: true });
    // What fired and ended is news (spec §4): one chronicle entry per occurrence, dated on its own day.
    const calendar = calendarFrom(query);
    const { skipped } = writeHappenings(ctx, chronicle, out.report.journal, { geo: buildGeo(world), rev: revOf(ctx), dateOf: day => dateText(calendar, day * DAY).replace(/,? \d{1,2}:\d{2}.*$/, '') });
    if (skipped.length) out.report.warnings.push(`The chronicle is full of events under way: ${skipped.length} happening(s) were not written as news (${skipped.slice(0, 3).join('; ')}).`);
    // A slot (a one-entry list) is written whole: replay puts the step's state back as recorded even when the reply that made it first is gone.
    chronicle.daily = toSlot(out.daily);
    const { report } = out;
    const fired = report.journal.filter(entry => entry.fired).map(entry => entry.by);
    // The warnings go to Problems, on this reply (the one sink, spec §9 Warnings), as well as on its card.
    const lost = lostOf(payload, fired);
    const problem = [report.warnings.length ? `World: ${report.warnings.slice(0, 6).join(' ')}` : '', lost.text].filter(Boolean).join(' ') || undefined;
    return { summary: [dailySummary(report), lost.text].filter(Boolean).join(' '), narrate: false, data: { from: report.from, to: report.to, days: report.days, fired, warnings: report.warnings.slice(0, 20), ...(lost.ids.length ? { lost: lost.ids } : {}) }, ...(problem ? { problem } : {}) };
}

/** The command, tagged with the feature (Story Block refuses it while the switch is off) and internal (never from a click or the sdk). */
export const dailyCommand = Object.assign(daily, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(dailyCommand, 'internal', { value: true, enumerable: true });
