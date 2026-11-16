import assert from 'node:assert/strict';
import {
    action, greeting, initial, reply, setup, user,
} from './helpers/store-chat.js';

export const isDeepFrozen = value => !value || typeof value !== 'object'
    || (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));

// The checkpoint rule these tests walk through (every 20 carriers / 32 KB, the old defaults): many
// checkpoints in a short chat. The defaults (100 / 128 KB) are checked on their own below.
export const SHORT = { checkpointEvery: 20, checkpointBytes: 32 * 1024 };

// A chat of `n` user/reply turns after the greeting, one action per reply.
export function story(n, options = SHORT) {
    const { ctx, store } = setup([greeting()], options);
    store.ensureInitial(initial());
    for (let i = 1; i <= n; i++) {
        ctx.chat.push(user(`turn ${i}`), reply(`reply ${i}`));
        action(store, `it_${i}`, i);
    }
    return { ctx, store };
}

// The greeting holds `bytes` of ops; `empty` replies with no record follow; then one more reply gets a
// record. → that record (has it a checkpoint?) and the chat.
export function afterOps(bytes, empty, options) {
    const big = n => [{ op: 'add', path: '/domains/scene/note', value: 'x'.repeat(n) }];
    const { ctx, store } = setup([greeting()], options);
    store.ensureInitial(initial());
    store.append({ ops: big(bytes - JSON.stringify(big(0)).length) });
    assert.equal(JSON.stringify(ctx.chat[0].extra.storySuite.ops).length, bytes);
    for (let i = 0; i < empty; i++) ctx.chat.push(user(), reply());
    ctx.chat.push(user(), reply());
    store.append({ ops: [{ op: 'replace', path: '/meta/rev', value: 1 }] });
    return { record: ctx.chat.at(-1).extra.storySuite, ctx, store };
}

export function fakeTimers() {
    let now = 0;
    let next = 1;
    const pending = new Map();
    return {
        setTimeout(fn, ms) { pending.set(next, { fn, at: now + ms }); return next++; },
        clearTimeout(id) { pending.delete(id); },
        advance(ms) {
            now += ms;
            for (const [id, { fn, at }] of [...pending]) if (at <= now) { pending.delete(id); fn(); }
        },
        count: () => pending.size,
    };
}

export const settle = () => new Promise(resolve => setImmediate(resolve));
