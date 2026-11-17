// World events, the daily step on the host: the `chronicle.world.daily` command (world-events switch). Run by code after a reply's
// lines (afterCapture) when the story day has changed since the last step: it steps every day from the last stepped one to today (spec v0.10 §9) and
// writes the results into the chronicle (`daily`, the step's state, and `conditions`). The changes are recorded in the reply that
// carries the step, so replay applies them and never rolls again. Its card lists what fired, ended and lapsed, the long-skip note
// and every warning. The first step of a chat starts at today and draws the campaign seed.

import { revOf } from '../domain-parts/lookup.js';
import { clockOf } from '../capture/text.js';
import { pointerOf } from '../conditions/key.js';
import { worldEventsOn } from '../capture/world-parts/switch.js';
import { WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { runDays } from '../../daily/step.js';
import { readWorld } from './read-world.js';
import { dailySummary } from './summary.js';

export const DAILY = 'chronicle.world.daily';
const DAY = 1440;

function newSeed(ctx) {
    let out = '';
    for (let i = 0; i < 16; i += 1) out += Math.floor((typeof ctx.rng === 'function' ? ctx.rng() : 0) * 16).toString(16);
    return out;
}

/** The conditions table becomes `next`: removed keys are marked ctx.ifThere (an older reply's entry may be gone on replay). */
function writeConditions(ctx, chronicle, next) {
    const table = chronicle.conditions ?? {};
    for (const key of Object.keys(table).sort()) {
        if (key in next) continue;
        if (typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', pointerOf(key));
        delete table[key];
    }
    for (const key of Object.keys(next).sort()) if (JSON.stringify(table[key]) !== JSON.stringify(next[key])) table[key] = next[key];
    if (Object.keys(table).length || chronicle.conditions) chronicle.conditions = table;
}

function daily(ctx) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'The world steps its days only when code checks the clock before a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const now = clockOf(ctx);
    if (now === null) return ctx.fail('NOT_YET', 'The story has no date yet; the world waits for one.');
    const chronicle = ctx.draft('chronicle');
    const state = chronicle.daily ?? null;
    const today = Math.floor(now / DAY);
    // A shrunk Re-read or a rewind can leave the last stepped day ahead of the clock: nothing is stepped again or undone.
    if (state && today <= state.day) return { summary: '', narrate: false, data: { days: 0 } };
    const out = runDays({ state, table: chronicle.conditions ?? {}, world: readWorld((name, args) => ctx.query(name, args)), today, seed: state?.seed ?? newSeed(ctx), rev: revOf(ctx) });
    if (!out) return { summary: '', narrate: false, data: { days: 0 } };
    writeConditions(ctx, chronicle, out.conditions);
    chronicle.daily = out.daily;
    const { report } = out;
    const fired = report.journal.filter(entry => entry.fired).map(entry => entry.by);
    // The warnings go to Problems, on this reply (the one sink, spec §9 Warnings), as well as on its card.
    const problem = report.warnings.length ? `World: ${report.warnings.slice(0, 6).join(' ')}` : undefined;
    return { summary: dailySummary(report), narrate: false, data: { from: report.from, to: report.to, days: report.days, fired, warnings: report.warnings.slice(0, 20) }, ...(problem ? { problem } : {}) };
}

/** The command, tagged with the feature (Story Block refuses it while the switch is off) and internal (never from a click or the sdk). */
export const dailyCommand = Object.assign(daily, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(dailyCommand, 'internal', { value: true, enumerable: true });
