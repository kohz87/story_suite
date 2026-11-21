// The Director judge's part of the world's ledger (switch story-director.world-events): `judged`, the count of its calls on world entries and on
// the daily roll (`{ calls, year, yearCalls }`, the Settings counter's game year as for open templates), and `marks`, its stored verdicts on the
// daily roll (`{ "<event id>|<day>": { veto?: reason, weight?: n } }`, the newest 64). Written whole into the ledger slot (rpg/slot.js), so a
// swipe or delete of a later reply never loses it. Pure.

import { isInt, isRecord } from '../domain-parts/shared-basics.js';
import { slotValue, toSlot } from '../../../rpg/slot.js';

export const MAX_MARKS = 64;
const MARK_KEY = /^[^|]{1,120}\|\d{1,7}$/;
const markOk = row => isRecord(row) && Object.keys(row).every(key => key === 'veto' || key === 'weight')
    && (row.veto === undefined || (typeof row.veto === 'string' && row.veto.length <= 200))
    && (row.weight === undefined || (typeof row.weight === 'number' && row.weight >= 0.5 && row.weight <= 2));

/** Adds `calls` (of game year `year`) and `marks` to the ledger slot on the `chronicle` draft; everything else in it is kept. */
export function storeJudged(chronicle, { calls = 0, year = null, marks = {} } = {}) {
    const old = slotValue(chronicle.ledger);
    const value = isRecord(old) ? { ...old } : {};
    if (!isRecord(value.anchors)) value.anchors = {};
    const before = isRecord(value.judged) && isInt(value.judged.calls) ? value.judged : { calls: 0 };
    const same = isInt(year) && before.year === year;
    value.judged = { calls: before.calls + calls, ...(isInt(year) ? { year, yearCalls: (same && isInt(before.yearCalls) ? before.yearCalls : 0) + calls } : {}) };
    if (Object.keys(marks).length) {
        const merged = { ...(isRecord(value.marks) ? value.marks : {}), ...marks };
        const keys = Object.keys(merged);
        for (const key of keys.slice(0, Math.max(0, keys.length - MAX_MARKS))) delete merged[key];
        value.marks = merged;
    }
    chronicle.ledger = toSlot(value);
}

/** The judged count of game year `year` (0 when none is kept). */
export function judgedCalls(stored, year) {
    const judged = slotValue(stored)?.judged;
    return isInt(year) && judged?.year === year && isInt(judged.yearCalls) ? judged.yearCalls : 0;
}

/** `judgedErrors(judged, marks)` → string[] for the ledger's validator (both optional). */
export function judgedErrors(judged, marks) {
    const errors = [];
    if (judged !== undefined && !(isRecord(judged) && isInt(judged.calls) && judged.calls >= 0 && Object.keys(judged).every(key => ['calls', 'year', 'yearCalls'].includes(key))
        && (judged.year === undefined || (isInt(judged.year) && isInt(judged.yearCalls) && judged.yearCalls >= 0)))) errors.push('chronicle.ledger.judged must be { calls } (and optionally year, yearCalls).');
    if (marks !== undefined && !(isRecord(marks) && Object.keys(marks).length <= MAX_MARKS && Object.entries(marks).every(([key, row]) => MARK_KEY.test(key) && markOk(row)))) {
        errors.push(`chronicle.ledger.marks must be at most ${MAX_MARKS} verdicts "<event>|<day>": { veto?, weight? (0.5-2) }.`);
    }
    return errors;
}
