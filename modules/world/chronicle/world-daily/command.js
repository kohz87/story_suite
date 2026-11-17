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
import { dailySummary } from './summary.js';
import { isWorldSeed } from './seed.js';

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
 * A Re-read's warning (seam audit E21): the events the reply's old step fired (`payload.before.fired`, the hook) that this step does not
 * fire. Later replies keep what they recorded, so a later firing that needed one keeps its record; the reader is told. '' when none.
 */
function lostText(payload, fired) {
    const lost = (Array.isArray(payload?.before?.fired) ? payload.before.fired : []).filter(id => typeof id === 'string' && !fired.includes(id));
    if (!lost.length) return '';
    return `World: after this edit ${lost.slice(0, 6).join(', ')} no longer fired on this reply's days; the later replies keep what they recorded (a later event that needed it is not undone).`;
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
        const lost = lostText(payload, []);
        return { summary: lost, narrate: false, data: { days: 0 }, ...(lost ? { problem: lost } : {}) };
    };
    if (state && today <= state.day) return kept();
    // The long-skip note shows above 14 stepped days, or above the reader's longest jump when that is lower (seam audit E16; the time part's setting, read through `settings.reads`).
    const longSkip = Math.min(LONG_SKIP, maxJumpMinutes(settingsFrom(ctx.settings)) / DAY);
    const seed = state?.seed ?? (isWorldSeed(chronicle.worldSeed) ? chronicle.worldSeed : newSeed(ctx));
    const out = runDays({ state, table: chronicle.conditions ?? {}, world: readWorld((name, args) => ctx.query(name, args)), today, seed, rev: revOf(ctx), longSkip });
    if (!out) return kept();
    writeConditions(ctx, chronicle, out.conditions);
    // A slot (a one-entry list) is written whole: replay puts the step's state back as recorded even when the reply that made it first is gone.
    chronicle.daily = toSlot(out.daily);
    const { report } = out;
    const fired = report.journal.filter(entry => entry.fired).map(entry => entry.by);
    // The warnings go to Problems, on this reply (the one sink, spec §9 Warnings), as well as on its card.
    const lost = lostText(payload, fired);
    const problem = [report.warnings.length ? `World: ${report.warnings.slice(0, 6).join(' ')}` : '', lost].filter(Boolean).join(' ') || undefined;
    return { summary: [dailySummary(report), lost].filter(Boolean).join(' '), narrate: false, data: { from: report.from, to: report.to, days: report.days, fired, warnings: report.warnings.slice(0, 20) }, ...(problem ? { problem } : {}) };
}

/** The command, tagged with the feature (Story Block refuses it while the switch is off) and internal (never from a click or the sdk). */
export const dailyCommand = Object.assign(daily, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(dailyCommand, 'internal', { value: true, enumerable: true });
