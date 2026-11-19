// The storage benchmark's measures (tests/bench/load.js): chat bytes and their breakdown, the old block size, and the head rebuild time after a load and a swipe.

import { performance } from 'node:perf_hooks';
import { createStore } from '../../core/store.js';
import { readRecord, isCarrier } from '../../core/persist.js';
import { KEY, STACKS, V1_BLOCK_CHARS, bytesOf, itemName } from './load-module.js';

const median = list => {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const percentile = (list, p) => {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
/** { n, median, p95, max } of a list of numbers. */
export function stats(list) {
    return { n: list.length, median: median(list), p95: percentile(list, 95), max: list.length ? Math.max(...list) : null };
}

/** The chat file's size as SillyTavern writes it: one JSON line per message (the header line left out). */
export function chatBytes(chat) {
    let total = 0;
    for (const message of chat) total += bytesOf(message) + 1;
    return total;
}

const HIDDEN = /\s*<!--\s*STORY_SUITE_V2\b[\s\S]*?-->/g;

/**
 * Where the bytes of a v2 chat are: { file, records (every storySuite copy, message.extra and
 * swipe_info), shown (message.extra copies only), checkpoint, ops, receipts, receiptData,
 * receiptSummary, other, changeText (the hidden change blocks, in mes and swipes), carriers,
 * checkpoints: [bytes] }.
 */
export function breakdown(chat) {
    const out = { file: chatBytes(chat), records: 0, shown: 0, checkpoint: 0, ops: 0, receipts: 0, receiptData: 0, receiptSummary: 0, other: 0, changeText: 0, carriers: 0, checkpoints: [] };
    for (const message of chat) {
        if (!isCarrier(message)) continue;
        out.carriers += 1;
        const texts = [message.mes, ...(message.swipes ?? [])];
        for (const text of texts) for (const match of String(text ?? '').matchAll(HIDDEN)) out.changeText += bytesOf(match[0]) - 2;
        const copies = [message.extra?.[KEY], ...(message.swipe_info ?? []).map(info => info?.extra?.[KEY])].filter(Boolean);
        copies.forEach((record, at) => {
            const size = bytesOf(record) + 14;   // + `"storySuite":` and a comma
            out.records += size;
            if (at === 0) out.shown += size;
            const checkpoint = record.checkpoint ? bytesOf(record.checkpoint) : 0;
            const ops = bytesOf(record.ops);
            const receipts = bytesOf(record.receipts);
            out.checkpoint += checkpoint;
            out.ops += ops;
            out.receipts += receipts;
            for (const receipt of record.receipts) {
                out.receiptData += bytesOf(receipt.data);
                out.receiptSummary += bytesOf(receipt.summary);
            }
            out.other += size - checkpoint - ops - receipts;
            if (at === 0 && record.checkpoint) out.checkpoints.push(checkpoint);
        });
    }
    return out;
}

/** The same chat without any v2 record or hidden change block: the story text alone. */
export function bareChat(chat) {
    return chat.map(message => {
        const copy = structuredClone(message);
        if (copy.extra) delete copy.extra[KEY];
        for (const info of copy.swipe_info ?? []) if (info?.extra) delete info.extra[KEY];
        copy.mes = String(copy.mes ?? '').replace(HIDDEN, '');
        if (Array.isArray(copy.swipes)) copy.swipes = copy.swipes.map(text => String(text ?? '').replace(HIDDEN, ''));
        return copy;
    });
}

/** A v1-style state block of about `chars` characters (the whole state as text, in the envelope). */
export function v1Block(chars = V1_BLOCK_CHARS) {
    const lines = ['<!-- STORY_BLOCKS_V1', '<Blocks>', '<Inventory>'];
    let i = 0;
    while (lines.join('\n').length < chars - 40) {
        lines.push(`${itemName(i % STACKS)} | ${1 + (i % 4)} | bench stack ${i + 1}`);
        i += 1;
    }
    lines.push('</Inventory>', '</Blocks>', '-->');
    return lines.join('\n');
}

/**
 * v1's size for the same story: the bare chat plus a ~3 KB block in each reply's `mes` and in its shown
 * swipe (SillyTavern keeps the text in both). Returns { file, perReply, block }.
 */
export function v1Size(chat, chars = V1_BLOCK_CHARS) {
    const bare = chatBytes(bareChat(chat));
    const block = `\n\n${v1Block(chars)}`;
    const perCopy = bytesOf(block) - 2;
    let replies = 0;
    for (const [index, message] of chat.entries()) if (isCarrier(message) && index > 0) replies += 1;
    return { file: bare + replies * perCopy * 2, perReply: perCopy * 2, block: perCopy, bare };
}

export function time(fn) {
    const start = performance.now();
    const value = fn();
    return { ms: performance.now() - start, value };
}

const gc = () => (typeof globalThis.gc === 'function' ? (globalThis.gc(), true) : false);

/**
 * Head rebuild after a chat load: a fresh store over a parsed copy of the saved chat (what the page has
 * after SillyTavern hands it the chat). { parseMs, rebuildMs: stats, heapBytes (the caches; null without
 * --expose-gc), headBytes, checkpointBytes }.
 */
export function measureLoad(chat, { repeat = 5 } = {}) {
    const json = JSON.stringify(chat);
    const parse = time(() => JSON.parse(json));
    const rebuilds = [];
    for (let r = 0; r < repeat; r++) {
        const copy = r === 0 ? parse.value : JSON.parse(json);
        const store = createStore({ chat: () => copy, save: async () => {} });
        rebuilds.push(time(() => store.head()).ms);
    }
    // The caches: what a store holds once it has built the head (the head state and the frozen copy of
    // the checkpoint it started from), as the heap grows when one is built over an already parsed chat.
    let heapBytes = null;
    if (gc()) {
        const before = process.memoryUsage().heapUsed;
        const held = createStore({ chat: () => parse.value, save: async () => {} });
        held.head();
        gc();
        heapBytes = process.memoryUsage().heapUsed - before;
        void held.head();
    }
    const store = createStore({ chat: () => parse.value, save: async () => {} });
    const head = store.head();
    const last = [...parse.value.keys()].reverse().find(index => readRecord(parse.value[index])?.checkpoint);
    // The longest replay a head can need: the carrier just before the last checkpoint, from the one before.
    const checkpoints = [...parse.value.keys()].filter(index => readRecord(parse.value[index])?.checkpoint);
    const worst = [];
    if (checkpoints.length > 1) {
        const target = checkpoints.at(-1) - 1;
        for (let r = 0; r < repeat; r++) {
            const fresh = createStore({ chat: () => parse.value, save: async () => {} });
            worst.push(time(() => fresh.at(target)).ms);
        }
    }
    return {
        parseMs: parse.ms, rebuildMs: stats(rebuilds), worstMs: stats(worst), heapBytes,
        headBytes: bytesOf(head), checkpointBytes: last === undefined ? 0 : bytesOf(readRecord(parse.value[last]).checkpoint),
        sinceCheckpoint: parse.value.slice(last).filter(isCarrier).length,
    };
}

/**
 * Head rebuild after a swipe of the last reply: a copy of the chat gets a new swipe the way SillyTavern
 * makes one (the extra copied along), then the store rebuilds; then the reader swipes back. { swipeMs,
 * backMs, sameAsBefore }.
 */
export function measureSwipe(chat, { repeat = 5 } = {}) {
    const swipe = [];
    const back = [];
    let sameAsBefore = true;
    for (let r = 0; r < repeat; r++) {
        const copy = structuredClone(chat);
        const store = createStore({ chat: () => copy, save: async () => {} });
        const before = JSON.stringify(store.head());
        const previous = [...copy.keys()].reverse().slice(1).find(index => isCarrier(copy[index]));
        const expected = JSON.stringify(store.at(previous));
        const message = copy.at(-1);
        message.swipes.push('');
        message.swipe_info.push({ send_date: '', extra: structuredClone(message.extra) });
        message.swipe_id = message.swipes.length - 1;
        message.mes = '';
        swipe.push(time(() => { store.rebuild(); return store.head(); }).ms);
        if (JSON.stringify(store.head()) !== expected) sameAsBefore = false;
        message.swipe_id = 0;
        message.mes = message.swipes[0];
        message.extra = structuredClone(message.swipe_info[0].extra);
        back.push(time(() => { store.rebuild(); return store.head(); }).ms);
        if (JSON.stringify(store.head()) !== before) sameAsBefore = false;
    }
    return { swipeMs: stats(swipe), backMs: stats(back), sameAsBefore };
}

// ---------- the run ----------

// How many messages of history a request carries (SillyTavern sends what fits the context, not the
// whole chat).
