// P23 closes the journal in the same root as the thread and its owner's settlement.
// The line is keyed by its reply (`replyKey`, never the live revision: after an edited Re-read with more lines a later
// reply's stored note could land on a revision key) and keeps the revision it was told at (`rev`) for its place in the history.

import { replyKey } from '../reply-keys.js';

export function threadOutcome(ctx, payload) {
    if (ctx.caller !== 'story-director') return ctx.fail('REFUSED', 'Thread outcomes come from the thread writer.');
    const chronicle = ctx.draft('chronicle');
    chronicle.questLog ??= {};
    const rev = Number.isSafeInteger(ctx.rev) && ctx.rev >= 0 ? ctx.rev : 0;
    chronicle.questLog[replyKey(ctx, chronicle.questLog)] = { thread: payload.thread, text: payload.text, rev };
    return { summary: payload.text, narrate: false, data: { thread: payload.thread } };
}
