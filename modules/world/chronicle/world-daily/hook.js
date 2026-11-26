// World events, the daily step on the host: the chronicle's afterCapture steps while the world-events switch is on. They run on
// the reply itself, after its story lines, so they are stored as part of that reply: a swipe or delete takes them back, a Re-read
// runs them again on the new lines, and later replies keep what they recorded (never rolled again).
//   the clock fallback (spec v0.10 §9 Clock): the reply moved no clock (no time line) → `director.advance` by an hour
//   the daily step: the story day is now past the last stepped one → `chronicle.world.daily` (the reply that crossed the day)
//   the death cue: an earlier reply left a must-happen death pending → `chronicle.world.cue` (written now, counted, or applied)
//   learned secrets: NPC State opened a pack secret not yet recorded → `chronicle.world.learned` (after the step: it holds from the next one)
//   hidden lore: a hidden entry's gate holds after the reply's lines and no reply opened it yet → `chronicle.world.loreOpen` (lore-open.js)

import { isInt } from '../domain-parts/shared-basics.js';
import { readRecord } from '../../../../core/persist.js';
import { ruleMarksOf } from '../../../../core/turn/rule-marks.js';
import { worldEventsOn } from '../conditions/feature.js';
import { DAILY } from './command.js';
import { CUE } from './cue-command.js';
import { pendingCues } from '../../daily/cues.js';
import { LEARNED, knownAnchors, learnedAnchors } from './learned.js';
import { LORE_OPEN, loreOpenDue } from './lore-open.js';
import { readWorld } from './read-world.js';
import { slotValue } from '../../../rpg/slot.js';
import { ledgerOf } from '../conditions/ledger.js';

const DAY = 1440;
export const FALLBACK_MINUTES = 60;
export const FALLBACK_CAUSE = 'world-clock';
// The receipts that move the clock by a reply's own line (capture.time) or a rule (director.advance, the fallback included).
const MOVES = new Set(['capture.time', 'director.advance']);

/** `dailyAfterCapture(view, info)` (`always`: it also runs for a reply with no story lines, for the cue only) → `{ commands }` (none while the switch is off, before the clock is set, or when nothing is due). */
function afterCapture(view, info = {}) {
    if (!worldEventsOn(view)) return undefined;
    // A reply with no story lines (`info.always`, the hook opted in for the cue) counts towards a pending death cue and nothing else:
    // the clock fallback and the daily step run as before, only on replies with lines.
    if (info?.always === true) {
        const held = slotValue(view?.state?.domains?.chronicle?.daily);
        return held && pendingCues(held).length ? { commands: [{ type: CUE, payload: {} }] } : undefined;
    }
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
    const settle = answered(state, view.state.domains.chronicle?.ledger);
    const literal = !state && literalReread(view, info);
    if (!state || Math.floor(now / DAY) > state.day || before || settle) commands.push({ type: DAILY, payload: { ...(before ? { before } : {}), ...(settle ? { settle: true } : {}), ...(literal ? { literalPlaces: true } : {}) } });
    if (state && pendingCues(state).length) commands.push({ type: CUE, payload: {} });
    if (opened(view)) commands.push({ type: LEARNED, payload: {} });
    if (loreOpenDue(view)) commands.push({ type: LORE_OPEN, payload: {} });
    return commands.length ? { commands } : undefined;
}

/** Whether a slot waiting for the Director's answer has it stored now (open templates: the daily step settles it). The asking ahead is not
 * done here (its state is the one before the step): open-store.js asks after the reply (afterReceive), from the state the step left. */
const answered = (state, ledger) => {
    const results = ledgerOf(ledger).open?.results ?? {};
    return (state?.pending ?? []).some(slot => slot.key in results);
};

/** Whether NPC State holds an opened pack secret the world has not recorded (only read when someone has an opened note). */
function opened(view) {
    const people = view?.state?.domains?.people;
    const bonds = people?.bonds?.npcs;
    if (!bonds || !Object.values(bonds).some(record => Array.isArray(record?.unlocked) && record.unlocked.length)) return false;
    const query = typeof view.query === 'function' ? (name, args) => view.query(name, args) : () => null;
    return learnedAnchors(people, readWorld(query).cast, knownAnchors(view.state.domains.chronicle)).length > 0;
}

/**
 * A Re-read of the reply that made a chat's first step, when that step did not read pack file ids: it ran before, the reply has no
 * `packPlaceIds` rule mark (first captured on an older build; the mark stays with the reply, receipt data does not) and its receipt
 * does not say `placeIds`. That step is made the old way again. A reply with no earlier step makes the chat's first step here.
 */
function literalReread(view, info) {
    if (info?.type !== 'reread' || ruleMarksOf(readRecord(view?.chat?.[info.index])?.rules).includes('packPlaceIds')) return false;
    let old = [];
    try { old = Array.isArray(info.previous) ? info.previous : []; } catch { old = []; }
    const steps = old.filter(receipt => receipt?.type === DAILY);
    return steps.length > 0 && !steps.some(receipt => receipt.data?.placeIds === 1);
}

/** In a Re-read with later messages: `{ fired }`, what the reply's old step fired or had lost, when there is any; else null. */
function rereadFired(view, info) {
    if (info?.type !== 'reread' || !Number.isInteger(info.index) || !(view?.chat?.length > info.index + 1)) return null;
    let old = [];
    try { old = Array.isArray(info.previous) ? info.previous : []; } catch { old = []; }
    // What the old step fired, and what an earlier Re-read of this reply had already lost (still a lost cause).
    const ids = list => (Array.isArray(list) ? list : []);
    const fired = old.filter(receipt => receipt?.type === DAILY).flatMap(receipt => [...ids(receipt.data?.fired), ...ids(receipt.data?.lost)]).filter(id => typeof id === 'string');
    return fired.length ? { fired: [...new Set(fired)].sort() } : null;
}

/** The hook, opted in to run for a reply with no story lines too (`always`; Story Block skips the others there). */
export const dailyAfterCapture = Object.assign(afterCapture, { always: true });
