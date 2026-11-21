// The world's ledger of marks made outside the daily step (switch story-director.world-events): `chronicle.ledger`, a slot
// `[{ anchors, tomb }]` written whole (rpg/slot.js), so replay after a delete never breaks a later reply.
//   anchors  `set:`/`cleared:` anchors a world line (or the Director) made: `{ "<anchor>": [days] }`. The daily step takes them into
//            its own anchors (the permanent ledger, seam audit E24) at its next step.
//   tomb     the conditions cleared today, `{ day, keys }`: a clear at a ref on day T is not undone by a set there on day T (spec §2
//            Same-day order, "clear beats set"), whoever clears and whoever sets (world line or daily step). Pure.

import { isInt, isRecord } from '../domain-parts/shared-basics.js';
import { slotValue, toSlot } from '../../../rpg/slot.js';
import { recordAnchor } from '../../daily/anchors.js';
import { judgedErrors } from '../world-judge/calls.js';

const MAX_KEYS = 64;
const MAX_ANCHORS = 256;
const MAX_RESULTS = 64;
const MAX_RESULTS_CHARS = 120000;

/** `{ anchors, tomb: { day, keys } }` from the stored slot (empty when there is none). */
export function ledgerOf(stored) {
    const value = slotValue(stored);
    const anchors = isRecord(value?.anchors) ? value.anchors : {};
    const tomb = isRecord(value?.tomb) && isInt(value.tomb.day) && Array.isArray(value.tomb.keys) ? value.tomb : null;
    const open = isRecord(value?.open) ? { results: isRecord(value.open.results) ? value.open.results : {}, calls: isInt(value.open.calls) ? value.open.calls : 0, ...(isInt(value.open.year) && isInt(value.open.yearCalls) ? { year: value.open.year, yearCalls: value.open.yearCalls } : {}) } : null;
    // `judged` (world-judge/calls.js): the Director judge's calls on world entries and pending events, `{ calls, year?, yearCalls? }`; `marks` its stored verdicts on the daily roll (world-judge/marks.js).
    const judged = isRecord(value?.judged) && isInt(value.judged.calls) ? { calls: value.judged.calls, ...(isInt(value.judged.year) && isInt(value.judged.yearCalls) ? { year: value.judged.year, yearCalls: value.judged.yearCalls } : {}) } : null;
    const marks = isRecord(value?.marks) ? value.marks : null;
    return { anchors, tomb: tomb ? { day: tomb.day, keys: [...tomb.keys] } : null, open, ...(judged ? { judged } : {}), ...(marks ? { marks } : {}) };
}

/** The fields a whole write of the slot keeps as they were (the Director judge's count and marks). */
const keptOf = old => ({ ...(old.judged ? { judged: old.judged } : {}), ...(old.marks ? { marks: old.marks } : {}) });

/**
 * Writes the slot whole on the `chronicle` draft: `anchors` recorded on `day`, and `tomb` keys cleared on `day` (a tomb of an
 * earlier day is dropped). `take`: the daily step took the anchors into its own (they are dropped here); `reset`: the tomb starts again.
 */
export function markLedger(chronicle, { day, anchors = [], tombKeys = [], take = false, reset = false }) {
    const old = ledgerOf(chronicle.ledger);
    const kept = take ? {} : structuredClone(old.anchors);
    for (const key of anchors) recordAnchor(kept, key, day);
    const sameDay = old.tomb && old.tomb.day === day && !reset;
    const keys = [...new Set([...(sameDay ? old.tomb.keys : []), ...tombKeys])].sort().slice(-MAX_KEYS);
    const value = { anchors: kept, ...(keys.length ? { tomb: { day, keys } } : {}), ...(old.open ? { open: old.open } : {}), ...keptOf(old) };
    if (Object.keys(kept).length || keys.length || old.open || old.judged || old.marks) chronicle.ledger = toSlot(value);
    else if (chronicle.ledger !== undefined) chronicle.ledger = null;
}

/**
 * Open templates (spec §9): the Director's stored answers by slot key (`{ outcome, answer? }`, the newest 64 kept, and within about 120000 characters: the oldest go first) and the count of model calls made
 * (a retry counts as a call). Written whole into the ledger slot, so a swipe or delete of the reply after it never loses it.
 */
export function storeOpen(chronicle, { results = {}, calls = 0, year = null }) {
    const old = ledgerOf(chronicle.ledger);
    const merged = { ...(old.open?.results ?? {}), ...results };
    const keys = Object.keys(merged);
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_RESULTS))) delete merged[key];
    // The newest 64 are also kept within a size: the oldest go first (never one stored now), so a run of long arc plans cannot grow the chat state without a bound.
    let size = Object.values(merged).reduce((sum, row) => sum + JSON.stringify(row).length, 0);
    for (const key of Object.keys(merged)) {
        if (size <= MAX_RESULTS_CHARS) break;
        if (key in results) continue;
        size -= JSON.stringify(merged[key]).length;
        delete merged[key];
    }
    // `yearCalls`: the calls of game year `year` (the Settings counter); a call in a later year starts it again from its own calls.
    const same = isInt(year) && old.open?.year === year;
    const tally = isInt(year) ? { year, yearCalls: (same ? old.open.yearCalls : 0) + calls } : {};
    chronicle.ledger = toSlot({ anchors: old.anchors, ...(old.tomb ? { tomb: old.tomb } : {}), open: { results: merged, calls: (old.open?.calls ?? 0) + calls, ...tally }, ...keptOf(old) });
}

/** `validateLedger(stored) → string[]`: optional; a slot holding `{ anchors, tomb? }`. */
export function validateLedger(stored) {
    if (stored === undefined || stored === null) return [];
    if (!Array.isArray(stored) || stored.length !== 1 || !isRecord(stored[0])) return ['chronicle.ledger must be null or a one-entry list (a slot).'];
    const { anchors, tomb, open, judged, marks, ...rest } = stored[0];
    const errors = [];
    if (!isRecord(anchors) || Object.keys(anchors).length > MAX_ANCHORS || Object.values(anchors).some(days => !Array.isArray(days) || !days.length || days.length > 8 || !days.every(isInt))) {
        errors.push(`chronicle.ledger.anchors must be at most ${MAX_ANCHORS} anchors, each a list of 1 to 8 days.`);
    }
    if (tomb !== undefined && !(isRecord(tomb) && isInt(tomb.day) && Array.isArray(tomb.keys) && tomb.keys.length <= MAX_KEYS && tomb.keys.every(key => typeof key === 'string' && key.includes('@')))) {
        errors.push(`chronicle.ledger.tomb must be { day, keys } with at most ${MAX_KEYS} condition keys.`);
    }
    if (open !== undefined && !(isRecord(open) && isRecord(open.results) && Object.keys(open.results).length <= MAX_RESULTS && isInt(open.calls) && open.calls >= 0 && (open.year === undefined || (isInt(open.year) && isInt(open.yearCalls) && open.yearCalls >= 0)))) errors.push('chronicle.ledger.open must be { results, calls } (and optionally year, yearCalls) with at most 64 results.');
    errors.push(...judgedErrors(judged, marks));
    if (Object.keys(rest).length) errors.push(`chronicle.ledger has an unknown field "${Object.keys(rest)[0]}".`);
    return errors;
}
