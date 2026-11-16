// How the store saves: createStore's save options, save stamps and read-back copies, rescue and the save-seq constants (storeSaving).

import { KEEPALIVE_MAX, createChatFile, utf8Bytes } from '../../store/chat-file.js';
import { carryRecord } from '../../persist.js';
import { isPlain } from './shared-plain.js';
import { markUsed } from './page-marks.js';
import { holdsRecord, newestRecord, rescueIndex } from './rescue-lookup.js';

/**
 * How the store saves (SPEC §3.3), for SillyTavern and the testkit alike:
 * * In SillyTavern the chat file is written directly (src/v2/chat-file.js), with the chat as it is in
 *   the same tick as the store's check that it is still the chat the change was made in; a refused
 *   save throws, so it stays unsaved, is told once and tried again. Where there is no such file (the
 *   testkit, a temporary chat) it is ctx.saveChat().
 * * A change left in a chat that is no longer open (rescue) is put into that chat's file as read back
 *   from the server: only its records, onto the same messages; nothing else in the file changes.
 * * The reader's actions are saved at once (sdk.command); the rest within 400 ms; when the page is
 *   closed with something unsaved, it is sent with keepalive, and the browser asks first if saves have
 *   been failing.
 * Returns the createStore() options for it.
 */
export function storeSaving({ ctx, live = () => ctx, fetch = null, onSaveError = null, storage = null }) {
    const context = () => {
        try { return live() ?? ctx; } catch { return ctx; }
    };
    const file = createChatFile({ context, ...(fetch ? { fetch } : {}) });
    // After a write timed out (persist.js createSaver): each later write of that chat carries a rising number
    // in its metadata (`stamp`), and this page keeps a copy of what it wrote (`kept`, by stamp, only until the
    // read-backs end) to put back when the file is found older and the chat is not the open one. Nothing is
    // stamped, kept or read without a timeout.
    let counter = 0;
    const kept = new Map();
    const seqOf = metadata => {
        const n = Number(isPlain(metadata) ? metadata[SAVE_SEQ_KEY] : NaN);
        return Number.isSafeInteger(n) ? n : 0;
    };
    function stampInto(metadata, messages) {
        counter = Math.max(counter, seqOf(metadata)) + 1;
        metadata[SAVE_SEQ_KEY] = counter;
        kept.set(counter, JSON.stringify({ metadata, messages }));
        while (kept.size > MAX_KEPT) kept.delete(kept.keys().next().value);
        return counter;
    }
    const memoKey = chatId => `${MEMO_PREFIX}${chatId}`;
    return {
        /**
         * Would a save of the open chat now go out with keepalive (a body of at most KEEPALIVE_MAX bytes as
         * UTF-8, B-a3-1)? Measured only when asked (the page is closing). True where this page does not write the file itself.
         */
        keepaliveFits() {
            if (!file.where()) return true;
            try {
                return utf8Bytes(JSON.stringify({ chat: [context().chatMetadata ?? {}, ...(ctx.chat ?? [])] })) + 256 <= KEEPALIVE_MAX;
            } catch { return false; }
        },
        chat: () => ctx.chat,
        // The chat's metadata (SillyTavern's, saved with the chat file): the store keeps the source-map archive there.
        metadata: () => context().chatMetadata ?? null,
        chatId: () => (typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId),
        place: () => file.where(),
        save: (change, { keepalive = false, signal = null, stamp: wanted = false } = {}) => {
            markUsed(context().chatMetadata, ctx.chat);
            const place = file.where();
            let metadata = context().chatMetadata;
            if (!isPlain(metadata)) metadata = {};
            const stamp = wanted ? stampInto(metadata, ctx.chat) : null;
            const out = stamp === null ? null : { stamp };
            if (!place) return Promise.resolve(ctx.saveChat()).then(() => out);
            return file.write(place, ctx.chat, metadata, { keepalive, signal }).then(() => out);
        },
        confirm: {
            /** Does the file of `change`'s chat hold the write stamped `stamp`, or a newer one? */
            async holds(change, stamp) {
                const place = change?.place ?? null;
                if (!place) return true;     // no file this page can read (ctx.saveChat saved it)
                const [header] = await file.read(place);
                return seqOf(header?.chat_metadata) >= stamp;
            },
            /**
             * Does the open chat hold the write stamped `stamp`, or a newer one (not a copy read back after the
             * late write landed)? By the newest record of the copy kept of that write, found in the open chat by
             * its `sid` with at least its `rev`; else by the number in the open chat's metadata.
             */
            fresh(stamp) {
                const copy = kept.get(stamp);
                const head = copy ? newestRecord(JSON.parse(copy).messages) : null;
                const mine = head ? (ctx.chat ?? []).map(message => message?.extra?.storySuite).find(record => isPlain(record) && record.sid === head.sid) : null;
                if (mine) return Number(mine.rev) >= Number(head.rev);
                return seqOf(context().chatMetadata) >= stamp;
            },
            /** Writes the copy kept of the write stamped `stamp` into `change`'s chat file; false when none is kept. */
            async restore(change, stamp) {
                const copy = kept.get(stamp);
                if (!copy || !change?.place) return false;
                const { metadata, messages } = JSON.parse(copy);
                await file.write(change.place, messages, metadata);
                return true;
            },
            forget: stamp => { kept.delete(stamp); },
        },
        // A1-2: a suspect chat's read-backs, kept over a reload of the page (browser storage; a missing or
        // full one only loses that convenience).
        memo: storage ? {
            get(chatId) {
                try {
                    const text = storage.getItem(memoKey(chatId));
                    return text ? JSON.parse(text) : null;
                } catch { return null; }
            },
            set(chatId, value) {
                try {
                    if (value) storage.setItem(memoKey(chatId), JSON.stringify(value));
                    else storage.removeItem(memoKey(chatId));
                } catch { /* only a convenience */ }
            },
        } : null,
        async rescue(change, entries, { stamp: wanted = false } = {}) {
            if (!entries.length) return null;
            if (!change?.place) throw new Error('this page cannot write to that chat\'s file');
            const [header, ...messages] = await file.read(change.place);
            if (!header || !messages.length) throw new Error('its chat file is no longer on the server (deleted, or renamed elsewhere)');
            let wrote = false;
            for (const { message, index } of entries) {
                const at = rescueIndex(message, messages, index);
                if (at < 0) throw new Error(`its chat file no longer holds message ${index} as it was`);
                if (holdsRecord(messages[at], message)) continue;
                if (!carryRecord(message, messages[at])) throw new Error(`its chat file no longer holds message ${index} as it was`);
                wrote = true;
            }
            if (!wrote) return null;    // the file holds every change already (SillyTavern saved it itself)
            // C4-5: the rescued file is marked as used too (markUsed), as a save of the open chat is.
            const metadata = isPlain(header.chat_metadata) ? header.chat_metadata : {};
            markUsed(metadata, messages);
            // A1-5: after a timeout of a write of this chat, the rescue is stamped as a save is.
            const stamp = wanted ? stampInto(metadata, messages) : null;
            await file.write(change.place, messages, metadata);
            return stamp === null ? null : { stamp };
        },
        onSaveError,
    };
}

// chat_metadata key of the rising save number written after a save timed out (storeSaving confirm).
export const SAVE_SEQ_KEY = 'storySuiteSave';
// Browser-storage key prefix of a suspect chat's read-backs (createSaver memo), and the copies kept at most.
export const MEMO_PREFIX = 'storySuite.saveCheck:';
const MAX_KEPT = 8;
