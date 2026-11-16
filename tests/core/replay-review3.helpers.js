import { guarded, harness } from './helpers/guarded.js';

export const clone = value => JSON.parse(JSON.stringify(value));
export const setStory = (host, at, text) => {
    host.ctx.chat[at].mes = text;
    host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id ?? 0] = text;
};
export const revsOf = host => {
    const out = [];
    for (const message of host.ctx.chat) for (const op of message.extra?.storySuite?.ops ?? []) if (op.path === '/meta/rev') out.push(op.value);
    return out;
};
export const receiptRevsOf = host => host.ctx.chat.flatMap(message => (message.extra?.storySuite?.receipts ?? []).map(receipt => receipt.rev));
export const inOrder = list => list.every((rev, n) => n === 0 || rev > list[n - 1]);

// SillyTavern's deleteSwipe: the swipe is spliced out and the next one is under swipe_id before MESSAGE_SWIPE_DELETED;
// what the reader sees (mes, extra) is loaded after it, with MESSAGE_SWIPED.
export async function stDeleteSwipe(host, index, swipe) {
    const message = host.ctx.chat[index];
    const current = message.swipe_id;
    message.swipe_info[current].extra = structuredClone(message.extra);
    message.swipes.splice(swipe, 1);
    message.swipe_info.splice(swipe, 1);
    const next = swipe < current ? current - 1 : swipe > current ? current : Math.min(swipe, message.swipes.length - 1);
    message.swipe_id = next;
    await host.st.eventSource.emit('message_swipe_deleted', { messageId: index, swipeId: swipe, newSwipeId: next });
    if (swipe === current) {
        message.mes = message.swipes[next];
        message.extra = structuredClone(message.swipe_info[next].extra);
        await host.st.eventSource.emit('message_swiped', index);
    }
}

export const SMALL3 = { checkpointEvery: 3, checkpointBytes: 1 << 30 };
export const cpOf = h => h.chat.map((message, i) => (message.extra?.storySuite?.checkpoint ? i : -1)).filter(i => i >= 0);
// The head of a chat as a full replay from its first record gives it (no checkpoint but the first is read).
export function fullReplay(h, modules = [guarded()]) {
    const fresh = harness(modules, { checkpointEvery: 100000, checkpointBytes: 1 << 30 });
    const copy = clone(h.chat);
    copy.forEach((message, i) => {
        for (const holder of [message.extra, ...(message.swipe_info ?? []).map(info => info?.extra)]) {
            const record = holder?.storySuite;
            if (i && record) { delete record.checkpoint; delete record.covers; delete record.coverHash; delete record.prefix; }
        }
    });
    fresh.chat.splice(0, fresh.chat.length, ...copy);
    fresh.store.rebuild();
    return fresh;
}
