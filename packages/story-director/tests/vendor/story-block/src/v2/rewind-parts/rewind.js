// Return in time: the branch at a reply, with that reply's later changes taken back (createRewind).

import { stBranch, stReopen } from './st-branch.js';
import { fail, limited } from './shared-limits.js';

/**
 * createRewind({ ctx, store, events?, branch?, reopen? }) → rewind({ index, beforeRev }) → Promise<
 * { ok: true, branch, index, rev, dropped, unsaved? } | { ok: false, code, message }>. `unsaved`: why the branch
 * is not saved yet (the store tries again).
 */
export function createRewind({ ctx, store, events = null, branch = stBranch(ctx), reopen = stReopen(ctx) }) {
    let running = false;
    return async function rewind({ index, beforeRev } = {}) {
        if (running) return fail('STALE', 'The story is already going back in time.');
        const chat = ctx?.chat ?? [];
        if (!Number.isInteger(index) || index < 0 || index >= chat.length || chat[index]?.is_user) {
            return fail('INVALID', 'Say which reply to go back to (the index of a message that keeps the story).');
        }
        if (!Number.isInteger(beforeRev) || beforeRev < 1) return fail('INVALID', 'Say which change to go back to (beforeRev, a whole number of 1 or more).');
        const record = chat[index]?.extra?.storySuite;
        if (!record || !Array.isArray(record.receipts)) return fail('NOT_FOUND', 'That reply holds no story changes to go back from.');
        running = true;
        try {
            // Worked out first on the messages the branch will hold (chat[0..index]); nothing is written.
            let plan;
            try {
                plan = store.truncate(index, beforeRev, { dryRun: true, chat: chat.slice(0, index + 1) });
            } catch (error) {
                return fail('FAILED', `The changes could not be taken back, so no branch was made: ${error?.message ?? error}`);
            }
            if (!plan.dropped.length) return fail('NOT_FOUND', 'That reply holds no changes from there on to take back; no branch was made.');
            // The branch is made from the chat file: the story must be in it first (C1-2: a save that
            // fails is told, never thrown at the reader).
            try { await store.flush(); } catch (error) {
                return fail('FAILED', `The story could not be saved first, so no branch was made: ${error?.message ?? error}`);
            }
            const from = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId;
            let name;
            try { name = await limited(() => branch(index), 'make the branch'); } catch (error) {
                return fail('FAILED', `The chat could not be branched: ${error?.message ?? error}`);
            }
            if (!name) return fail('FAILED', 'SillyTavern did not create the branch.');
            // On the branch something still went wrong: back to the chat the reader was in.
            const back = async why => {
                let where = `the branch "${name}" is open`;
                try {
                    if (from) {
                        await reopen(from);
                        where = `you are back in "${from}" (the branch "${name}" was kept)`;
                    }
                } catch (error) {
                    where = `the branch "${name}" is open; "${from}" could not be opened again: ${error?.message ?? error}`;
                }
                return fail('FAILED', `${why}; nothing was taken back, and ${where}.`);
            };
            // The branch is the current chat now; its last message is the carrier we branched at.
            const at = (ctx.chat ?? []).length - 1;
            if (at !== index) return back(`The branch ends at message ${at}, not ${index}`);
            store.rebuild();
            let result;
            try { result = store.truncate(index, beforeRev); } catch (error) {
                return back(`The changes could not be taken back on the branch: ${error?.message ?? error}`);
            }
            // Taken back on the branch; a save that fails now is tried again (and told) by the store.
            let unsaved = '';
            try { await store.flush(); } catch (error) { unsaved = String(error?.message ?? error); }
            store.rebuild();
            events?.emit('head', { index: store.headIndex(), reason: 'rewind' });
            return { ok: true, branch: name, index, rev: result.rev, dropped: result.dropped, ...(unsaved ? { unsaved } : {}) };
        } finally {
            running = false;
        }
    };
}
