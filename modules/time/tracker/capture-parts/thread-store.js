// Story Director v2, tracker part: new thread ids and the write-back of the records the rules returned.

import { lineKey } from '../../../world/changes.js';
import { fromRecord, keysOf, orderedThreads, sameValue } from '../convert.js';
import { revOf } from './reply.js';

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

// Thread IDs come from `ctx.id('th')` (deterministic from the receipt's seed, so a rebuild or a
// test gives the same ones); from ctx.rng() only for a host that has no ctx.id.
export function newId(ctx, taken) {
    for (let tries = 0; tries < 64; tries += 1) {
        let id = typeof ctx?.id === 'function' ? ctx.id('th') : '';
        if (!/^th_[0-9a-z]{8}$/.test(id ?? '')) {
            id = 'th_';
            for (let i = 0; i < 8; i += 1) id += ID_CHARS[Math.floor(ctx.rng() * ID_CHARS.length) % ID_CHARS.length];
        }
        if (!taken.has(id)) {
            taken.add(id);
            return id;
        }
    }
    throw new Error('No free thread id.');
}

// Writes the records the rules returned onto the draft: only threads that changed, and the key
// index, so the command's ops are the change and nothing else. A record the rules left as it was read
// (`read`: each record as text before the rules ran) is not written back at all: read in and out
// again, an older thread could come out a little different (an offer that closed losing what it was
// offered as), and the line would write into a thread another reply made (B-b1r2-12).
export function writeBack(director, records, ctx, read = new Map()) {
    const rev = revOf(ctx);
    const before = new Map(orderedThreads(director).map(thread => [lineKey(thread.key), thread]));
    const ids = new Set(Object.keys(director.threads));
    let order = Math.max(-1, ...orderedThreads(director).map(thread => thread.track?.order ?? 0));
    const idOf = new Map();
    for (const record of records) {
        const prev = before.get(record.id) ?? null;
        const id = prev?.id ?? newId(ctx, ids);
        idOf.set(record.id, id);
        if (prev && read.get(record.id) === JSON.stringify(record)) continue;
        const thread = fromRecord(record, prev, { id, rev, order: prev ? undefined : (order += 1) });
        if (!sameValue(thread, prev)) director.threads[id] = thread;
    }
    const keys = keysOf(records, record => idOf.get(record.id));
    for (const name of Object.keys(director.keys)) if (!Object.hasOwn(keys, name) && idOf.has(lineKey(director.threads[director.keys[name]]?.key ?? ''))) delete director.keys[name];
    for (const [name, id] of Object.entries(keys)) if (director.keys[name] !== id) director.keys[name] = id;
    return idOf;
}
