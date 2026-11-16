// A reply held back because what its interaction settle read changed: kept in chat metadata by the reply's record id (add-only markers,
// like the board's), found again after a reload, and ended by a discard. The reply's own prelude shows when its settle was kept.

import { readRecord } from '../persist.js';
import { settleStep } from './watch.js';

const KEY = 'storySuiteInteraction';
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The held marker of reply `sid` unless its settle has been kept on the reply since (`receipts`), else null. */
export function heldForSid(meta, sid, receipts = []) {
    const held = typeof sid === 'string' ? meta?.[KEY]?.held?.[sid] : null;
    const payload = settleStep(held?.current)?.payload;
    if (!plain(held) || !payload) return null;
    const done = receipts.some(receipt => receipt?.type === 'interaction.settle' && receipt.beforeGenerate === true && receipt.replan?.payload?.key === payload.key);
    return done ? null : held;
}

export function heldForMessage(meta, message) {
    if (!plain(meta?.[KEY]?.held)) return null;
    const record = readRecord(message);
    return record ? heldForSid(meta, record.sid, record.receipts) : null;
}

/** Marks the reply held (once; the first marker stays). `staged`: the session was still open when it was held. */
export function rememberHeld(meta, sid, current, staged) {
    if (!plain(meta) || typeof sid !== 'string' || !sid || !settleStep(current)) return false;
    if (!plain(meta[KEY])) meta[KEY] = {};
    if (!plain(meta[KEY].held)) meta[KEY].held = {};
    if (!Object.hasOwn(meta[KEY].held, sid)) {
        meta[KEY].held[sid] = { current: structuredClone({ type: current.type, prechecks: current.prechecks, base: current.base, untold: current.untold, stopped: current.stopped === true }), staged };
    }
    return true;
}

/** The reader discards the interaction a held reply waits on: the reply stays held (regenerate it); a resume no longer runs. */
export function discardHeld(meta, id) {
    const box = meta?.[KEY];
    if (!plain(box?.held)) return false;
    let found = false;
    for (const [sid, held] of Object.entries(box.held)) {
        if (settleStep(held?.current)?.payload?.id !== id) continue;
        if (!plain(box.heldDiscarded)) box.heldDiscarded = {};
        box.heldDiscarded[sid] = true;
        found = true;
    }
    return found;
}
