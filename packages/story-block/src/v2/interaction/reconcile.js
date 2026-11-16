// Keeps the unsent interaction scratch in chat metadata true to the story line after any head move (delete, rewind, restore, branch, chat change):
// a carried segment whose receipt is gone goes back to its base (or is marked invalidated), and records whose replies are not in the chat are pruned.
// It never creates the metadata box: with no interaction ever used, nothing is read or written.

import { readRecord } from '../persist.js';
import { hashJson } from '../replay.js';
import { receiveSegment, reconcileSession } from './carry.js';

const KEY = 'storySuiteInteraction';
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * → true when the metadata changed (the caller saves it). `active()` lists the receipts that are on the line now (store.receipts():
 * a block taken back keeps its receipt in the reply's record, inactive, and does not count); without it the replies' own receipts do.
 * With `kindOf` and `state`, a carried session whose earlier segment was settled again with another result is rebuilt from it (no steps) or invalidated (steps).
 */
export function reconcileInteraction(meta, chat, active = null, { kindOf = () => null, state = () => null } = {}) {
    const box = plain(meta) && plain(meta[KEY]) ? meta[KEY] : null;
    if (!box) return false;
    const sids = new Set(), ids = new Set();
    for (const message of Array.isArray(chat) ? chat : []) {
        const record = readRecord(message);
        if (!record) continue;
        if (typeof record.sid === 'string') sids.add(record.sid);
        if (!active) for (const receipt of record.receipts ?? []) if (typeof receipt?.id === 'string') ids.add(receipt.id);
    }
    if (active) for (const entry of active()) if (typeof (entry?.receipt ?? entry)?.id === 'string') ids.add((entry.receipt ?? entry).id);
    let changed = false;
    const drop = (holder, key) => { if (holder && Object.hasOwn(holder, key)) { delete holder[key]; changed = true; } };
    if (plain(box.open)) {
        const before = JSON.stringify(box.open);
        // A carried segment is taken back one level at a time (its base is the segment before): go on until the carry is on the line again, or steps are staged.
        let session = reconcileSession(box, id => ids.has(id));
        for (let level = 0; level < 99 && session.carried && !session.invalidated && !ids.has(session.carried); level += 1) session = reconcileSession(box, id => ids.has(id));
        const carriedFrom = typeof session.carriedKey === 'string' && typeof session.prior === 'string' && active
            ? active().find(entry => (entry?.receipt ?? entry)?.type === 'interaction.settle' && (entry.receipt ?? entry).replan?.payload?.key === session.carriedKey) : null;
        const received = (carriedFrom?.receipt ?? carriedFrom)?.data?.v2?.result;
        if (session.invalidated !== true && received && hashJson(received) !== session.prior) {
            // The segment this one was carried from was settled again with another result: its next setup is no longer true.
            if (session.steps?.length) session.invalidated = true;
            else receiveSegment(box, kindOf(session.kindId), carriedFrom.receipt.replan.payload, received, readRecord(chat[carriedFrom.index])?.sid, carriedFrom.receipt.id, state());
        }
        session = box.open;
        if (session.invalidated !== true && !sids.has(session.anchor)) drop(box, 'open');
        else if (JSON.stringify(box.open) !== before) changed = true;
    }
    for (const name of ['held', 'heldDiscarded']) {
        if (!plain(box[name])) continue;
        for (const sid of Object.keys(box[name])) if (!sids.has(sid)) drop(box[name], sid);
    }
    if (plain(box.start) && !sids.has(box.start.anchor)) drop(box, 'start');
    if (plain(box.send) && !sids.has(box.send.anchor)) drop(box, 'send');
    return changed;
}
