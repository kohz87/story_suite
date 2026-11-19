// The storage benchmark's replays (tests/bench/load.js): a finished chat under other checkpoint and op rules, and copy checks, for the tuning tables.

import { createStore } from '../../core/store.js';
import { apply as applyOps } from '../../core/ops.js';
import { readRecord, isCarrier } from '../../core/persist.js';
import { KEY, bytesOf } from './load-module.js';

export function relayout(chat, { every = 20, bytes = 32 * 1024 } = {}) {
    const copy = structuredClone(chat);
    let state = null;
    let carriers = 0;
    let opBytes = 0;
    let first = true;
    let since = [];   // the records a new checkpoint covers (store.js chain)
    for (const message of copy) {
        const record = readRecord(message);
        if (!isCarrier(message) || !record) continue;
        if (first) {
            state = record.checkpoint;
            first = false;
        } else {
            carriers += 1;
            const due = carriers >= every || opBytes > bytes;
            if (due) {
                record.checkpoint = structuredClone(state);
                record.covers = since;
                since = [];
                carriers = 0;
                opBytes = 0;
            } else {
                delete record.checkpoint;
                delete record.covers;
            }
        }
        since.push(record.sid);
        opBytes += bytesOf(record.ops);
        state = applyOps(state, record.ops);
        syncSwipe(message, record);
    }
    return copy;
}

// Keeps a copy the shown swipe holds in step (where the record is kept once, there is none to keep).
function syncSwipe(message, record) {
    const info = message.swipe_info?.[message.swipe_id ?? 0];
    if (info?.extra?.[KEY]) info.extra[KEY] = structuredClone(record);
}

/**
 * One carrier's ops with the safe redundancy removed: every `/meta/rev` replace but the last, and any
 * `replace` of a path that a later op of the same carrier replaces again. Same result when applied,
 * because `diff` only appends to arrays or replaces them whole, so no later op shifts an earlier path.
 */
export function compactCarrierOps(ops) {
    const lastAt = new Map();
    const firstWas = new Map();   // a count's kept op takes the `was` of the first op it stands for
    ops.forEach((op, index) => {
        if (op.op !== 'replace') return;
        lastAt.set(op.path, index);
        if (typeof op.was === 'number' && !firstWas.has(op.path)) firstWas.set(op.path, op.was);
    });
    return ops
        .filter((op, index) => !(op.op === 'replace' && lastAt.get(op.path) !== index))
        .map(op => (op.op === 'replace' && firstWas.has(op.path) ? { ...op, was: firstWas.get(op.path) } : op));
}

/**
 * The chat with each carrier's ops compacted (and `spans` dropped, since they no longer line up; a
 * real compaction would keep story and kept spans apart).
 */
export function compactOps(chat) {
    const copy = structuredClone(chat);
    for (const message of copy) {
        const record = readRecord(message);
        if (!record) continue;
        record.ops = compactCarrierOps(record.ops);
        record.spans = [{ n: record.ops.length, story: false }];
        syncSwipe(message, record);
    }
    return copy;
}

/**
 * The chat with receipts older than `keep` replies (counted back from the head) trimmed to what Re-read,
 * narration and the claims never need again: `data` emptied (and `summary` too when `summaries` is set).
 */
export function stripOldReceipts(chat, { keep = 200, summaries = false } = {}) {
    const copy = structuredClone(chat);
    const carriers = [...copy.keys()].filter(index => isCarrier(copy[index]));
    for (const index of carriers.slice(0, Math.max(0, carriers.length - keep))) {
        const record = readRecord(copy[index]);
        if (!record) continue;
        record.receipts = record.receipts.map(receipt => ({ ...receipt, data: {}, ...(summaries ? { summary: '' } : {}) }));
        syncSwipe(copy[index], record);
    }
    return copy;
}

/**
 * The same chat with the record kept once: the shown swipe's copy in `swipe_info` is dropped on every
 * carrier but the last (only the last message can be swiped). Other swipes keep their own records.
 */
export function singleCopy(chat) {
    const copy = structuredClone(chat);
    const lastIndex = copy.findLastIndex(isCarrier);
    copy.forEach((message, index) => {
        const info = message.swipe_info?.[message.swipe_id ?? 0];
        if (index !== lastIndex && info?.extra && info.extra !== message.extra) delete info.extra[KEY];
    });
    return copy;
}

/**
 * The chat as it was stored before each record was kept once: the shown swipe's copy in `swipe_info` on
 * every carrier.
 */
export function everyCopy(chat) {
    const copy = structuredClone(chat);
    for (const message of copy) {
        const info = message.swipe_info?.[message.swipe_id ?? 0];
        if (readRecord(message) && info && info.extra !== message.extra) {
            info.extra ??= {};
            info.extra[KEY] = structuredClone(message.extra[KEY]);
        }
    }
    return copy;
}

/** Head equality of two chats, by replay through a fresh store each. */
export function sameHead(a, b) {
    const head = chat => JSON.stringify(createStore({ chat: () => chat, save: async () => {} }).head());
    return head(a) === head(b);
}
