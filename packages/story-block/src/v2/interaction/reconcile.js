// Keeps the unsent interaction scratch in chat metadata true to the story line after any head move (delete, rewind, restore, branch, swipe flip, chat change):
// a carried segment whose receipt is gone goes back to its base (or is marked invalidated), one whose earlier segment came out again with another result is
// made again from it, and records whose replies are not in the chat are pruned. It never creates the metadata box: with no interaction ever used, nothing is read or written.

import { readRecord } from '../persist.js';
import { hashJson } from '../replay.js';
import { reconcileSession } from './carry.js';

const KEY = 'storySuiteInteraction';
const SETTLE = 'interaction.settle';
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const settleOf = entry => { const receipt = entry?.receipt ?? entry; return receipt?.type === SETTLE && plain(receipt.replan?.payload) ? receipt : null; };

/**
 * → true when the metadata changed (the caller saves it). `active()` lists the receipts on the line now, as { index, receipt } (store.receipts(): a block taken back
 * keeps its receipt in the reply's record, inactive, and does not count); without it the replies' own receipts do. `kindOf(kindId)` and `stateAt(index)` (the story
 * after that reply) let a carried session be made again from its earlier segment's new result.
 */
export function reconcileInteraction(meta, chat, active = null, { kindOf = () => null, stateAt = () => null } = {}) {
    const box = plain(meta) && plain(meta[KEY]) ? meta[KEY] : null;
    if (!box) return false;
    const sids = new Set(), ids = new Set(), sidAt = [];
    (Array.isArray(chat) ? chat : []).forEach((message, index) => {
        const record = readRecord(message);
        if (!record) return;
        sidAt[index] = record.sid;
        if (typeof record.sid === 'string') sids.add(record.sid);
        if (!active) for (const receipt of record.receipts ?? []) if (typeof receipt?.id === 'string') ids.add(receipt.id);
    });
    const entries = active ? active() : [];
    for (const entry of entries) if (typeof (entry?.receipt ?? entry)?.id === 'string') ids.add((entry.receipt ?? entry).id);
    let changed = false;
    const drop = (holder, key) => { if (holder && Object.hasOwn(holder, key)) { delete holder[key]; changed = true; } };
    if (plain(box.open)) {
        const before = JSON.stringify(box.open);
        let session = box.open;
        // The segment this one was carried from, as it stands on the line now: found by its key (a swipe or a re-plan gives the settle another receipt id, same key).
        const from = typeof session.carriedKey === 'string' && typeof session.prior === 'string'
            ? entries.find(entry => settleOf(entry)?.replan.payload.key === session.carriedKey) : null;
        const found = settleOf(from), result = found?.data?.v2?.result;
        if (found && session.carried !== found.id && result && hashJson(result) === session.prior) {
            // A swipe flip: the same segment with the same result is on the line under another receipt and reply; follow it, keeping the staged steps.
            session.carried = found.id;
            if (sidAt[from.index]) session.anchor = sidAt[from.index];
            delete session.invalidated;
        }
        // A carried segment is taken back one level at a time (its base is the segment before): go on until the carry is on the line again, or steps are staged.
        session = reconcileSession(box, id => ids.has(id));
        for (let level = 0; level < 99 && session.carried && !session.invalidated && !ids.has(session.carried); level += 1) session = reconcileSession(box, id => ids.has(id));
        const now = typeof session.carriedKey === 'string' ? entries.find(entry => settleOf(entry)?.replan.payload.key === session.carriedKey) : null;
        const settled = settleOf(now), received = settled?.data?.v2?.result, kind = kindOf(session.kindId);
        if (session.invalidated !== true && received && hashJson(received) !== session.prior && kind?.carry === true && typeof kind.next === 'function') {
            // The segment this one was carried from was settled again with another result: its next setup is no longer true.
            if (session.steps?.length) session.invalidated = true;
            else {
                let setup = null;
                try { setup = kind.next(structuredClone(settled.replan.payload.setup), structuredClone(received), stateAt(now.index)); } catch { setup = null; }
                if (plain(setup)) {
                    session.setup = setup;
                    session.prior = hashJson(received);
                    session.carried = settled.id;
                    if (sidAt[now.index]) session.anchor = sidAt[now.index];
                    delete session.witness;
                }
            }
        }
        // An idle session was moved onto a reply that said nothing for it: when that reply is gone it goes back to the one it came from.
        if (session.invalidated !== true && !sids.has(session.anchor) && session.idle === true) {
            const path = [...(session.idlePath ?? [])];
            let back = null;
            while (path.length && back === null) { const sid = path.pop(); if (sids.has(sid)) back = sid; }
            if (back !== null) {
                session.anchor = back;
                if (path.length) { session.idlePath = path; session.idleFrom = path.at(-1); } else for (const key of ['idle', 'idleFrom', 'idlePath']) delete session[key];
            }
        }
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
