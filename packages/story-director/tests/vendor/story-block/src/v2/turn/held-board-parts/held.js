// Remembers, finds and discards a fight held back for a reply, kept in chat metadata by the reply's record id.

import { readRecord } from '../../persist.js';
import { boardStep, object } from './shared-board.js';

export function heldForSid(meta, sid, receipts = []) {
    const held = typeof sid === 'string' ? meta?.rpgFightHeld?.[sid] : null;
    const step = boardStep(held?.current);
    if (!object(held) || !step) return null;
    const done = receipts.some(receipt => receipt?.type === 'rpg.resolve' && receipt.beforeGenerate === true
        && receipt.replan?.payload?.key === step.payload.key && receipt.replan?.payload?.board?.id === step.payload.board.id);
    return done ? null : held;
}

export function heldForMessage(meta, message) {
    if (!object(meta?.rpgFightHeld)) return null;
    const record = readRecord(message);
    return record ? heldForSid(meta, record.sid, record.receipts) : null;
}

export function rememberHeld(meta, sid, current, staged) {
    if (!object(meta) || typeof sid !== 'string' || !sid || !boardStep(current)) return false;
    if (!object(meta.rpgFightHeld)) meta.rpgFightHeld = {};
    if (!Object.hasOwn(meta.rpgFightHeld, sid)) {
        meta.rpgFightHeld[sid] = { current: structuredClone({ type: current.type, prechecks: current.prechecks,
            base: current.base, untold: current.untold, stopped: current.stopped === true }), staged };
    }
    return true;
}

export function discardHeld(meta, sid) {
    if (!object(meta) || typeof sid !== 'string' || !meta.rpgFightHeld?.[sid]) return;
    if (!object(meta.rpgFightHeldDiscarded)) meta.rpgFightHeldDiscarded = {};
    if (!Object.hasOwn(meta.rpgFightHeldDiscarded, sid)) meta.rpgFightHeldDiscarded[sid] = true;
}
