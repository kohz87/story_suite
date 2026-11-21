// Helpers for the sealed-history tests: a chat grown reply by reply with a store that seals at a small window, and a fresh store over a
// JSON round-trip of the chat and its metadata (a reload: nothing cached carries over).
import { action, apply, createStore, greeting, initial, nextId, reply, user } from './helpers/store-chat.js';

export const SMALL = Object.freeze({ window: 4, step: 2 });

/** A store over `ctx.chat` and `ctx.meta` (the chat's metadata), sealing at `sealing`; `checkpointEvery` small so checkpoints fall in the window. */
export function sealedSetup({ chat = [greeting()], meta = {}, sealing = SMALL, checkpointEvery = 3 } = {}) {
    const ctx = { chat, meta, saves: 0 };
    const store = createStore({ chat: () => ctx.chat, save: async () => { ctx.saves++; }, apply, recordId: nextId, metadata: () => ctx.meta,
        sealing, checkpointEvery, chatId: () => 'chat-1' });
    return { ctx, store };
}

/** Grows the chat by `n` replies, each with one action on its own item (`item<k>`) and one on a shared counter. */
export function grow(ctx, store, n, from = 0) {
    if (!store.head()) store.ensureInitial(initial());
    for (let k = from; k < from + n; k++) {
        ctx.chat.push(user(`Turn ${k}.`), reply(`Reply ${k}.`));
        store.rebuild();
        action(store, `item${k}`, k + 1);
        action(store, 'coin', k + 10);
    }
}

/** A new store over a JSON copy of the chat and metadata (a reload), rebuilt once. */
export function reload(ctx, options = {}) {
    const copy = { chat: JSON.parse(JSON.stringify(ctx.chat)), meta: JSON.parse(JSON.stringify(ctx.meta)) };
    const again = sealedSetup({ chat: copy.chat, meta: copy.meta, ...options });
    again.store.rebuild();
    return again;
}

/** The carriers whose shown record is sealed. */
export const sealedIndexes = chat => chat.map((message, i) => (message?.extra?.storySuite?.sealed === 1 ? i : -1)).filter(i => i >= 0);

/** What a reader can see of the chat's story: the head, its Problems and the receipts (less what a sealed receipt drops). */
export function readout(store) {
    const bare = ({ seed, replan, ...rest }) => { void seed; void replan; return rest; };
    return JSON.stringify({ head: store.head(), problems: store.problems().map(({ message, ...rest }) => { void message; return rest; }),
        receipts: store.receipts().map(entry => ({ index: entry.index, receipt: bare(entry.receipt) })), proofs: store.proofs() });
}
