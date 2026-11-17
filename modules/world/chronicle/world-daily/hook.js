// World events, the daily step on the host: the chronicle's afterCapture steps while the world-events switch is on. They run on
// the reply itself, after its story lines, so they are stored as part of that reply: a swipe or delete takes them back, a Re-read
// runs them again on the new lines, and later replies keep what they recorded (never rolled again).
//   the clock fallback (spec v0.10 §9 Clock): the reply moved no clock (no time line) → `director.advance` by an hour
//   the daily step: the story day is now past the last stepped one → `chronicle.world.daily` (the reply that crossed the day)

import { isInt } from '../domain-parts/shared-basics.js';
import { worldEventsOn } from '../conditions/feature.js';
import { DAILY } from './command.js';

const DAY = 1440;
export const FALLBACK_MINUTES = 60;
export const FALLBACK_CAUSE = 'world-clock';
// The receipts that move the clock by a reply's own line (capture.time) or a rule (director.advance, the fallback included).
const MOVES = new Set(['capture.time', 'director.advance']);

/** `dailyAfterCapture(view, info)` → `{ commands }` (none while the switch is off, before the clock is set, or when nothing is due). */
export function dailyAfterCapture(view, info = {}) {
    if (!worldEventsOn(view)) return undefined;
    let now = view?.state?.domains?.director?.time?.minutes;
    if (!isInt(now)) return undefined;
    const commands = [];
    let receipts = [];
    try { receipts = Array.isArray(info?.receipts) ? info.receipts : []; } catch { receipts = []; }
    if (!receipts.some(receipt => MOVES.has(receipt?.type))) {
        commands.push({ type: 'director.advance', payload: { minutes: FALLBACK_MINUTES, cause: FALLBACK_CAUSE, reason: 'no time line in the reply' } });
        now += FALLBACK_MINUTES;
    }
    const state = view.state.domains.chronicle?.daily ?? null;
    if (!state || Math.floor(now / DAY) > state.day) commands.push({ type: DAILY, payload: {} });
    return commands.length ? { commands } : undefined;
}
