// World events, the daily step on the host: the chronicle's afterCapture steps while the world-events switch is on. They run on
// the reply itself, after its story lines, so they are stored as part of that reply: a swipe or delete takes them back, a Re-read
// runs them again on the new lines, and later replies keep what they recorded (never rolled again).
//   the clock fallback (spec v0.10 §9 Clock): the reply moved no clock (no time line) → `director.advance` by an hour
//   the daily step: the story day is now past the last stepped one → `chronicle.world.daily` (the reply that crossed the day)

import { isInt } from '../domain-parts/shared-basics.js';
import { worldEventsOn } from '../conditions/feature.js';
import { DAILY } from './command.js';
import { slotValue } from '../../../rpg/slot.js';

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
        commands.push({ type: 'director.advance', payload: { minutes: FALLBACK_MINUTES, cause: FALLBACK_CAUSE, reason: 'no time line in the reply', soft: true } });
        now += FALLBACK_MINUTES;
    }
    const state = slotValue(view.state.domains.chronicle?.daily);
    // A Re-read of a reply that is not the last (seam audit E21): the events its old step fired go with the step, so the step can say
    // which of them it no longer fires; the later replies keep what they recorded (history is not rewritten), so that is a warning.
    const before = rereadFired(view, info);
    if (!state || Math.floor(now / DAY) > state.day || before) commands.push({ type: DAILY, payload: before ? { before } : {} });
    return commands.length ? { commands } : undefined;
}

/** In a Re-read with later messages: `{ fired }` of the reply's old step when it fired anything; else null. */
function rereadFired(view, info) {
    if (info?.type !== 'reread' || !Number.isInteger(info.index) || !(view?.chat?.length > info.index + 1)) return null;
    let old = [];
    try { old = Array.isArray(info.previous) ? info.previous : []; } catch { old = []; }
    const fired = old.filter(receipt => receipt?.type === DAILY).flatMap(receipt => (Array.isArray(receipt.data?.fired) ? receipt.data.fired : [])).filter(id => typeof id === 'string');
    return fired.length ? { fired: [...new Set(fired)].sort() } : null;
}
