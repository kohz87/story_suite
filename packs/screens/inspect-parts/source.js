// The source the Inspector widget reads over the host's store, with the reader's picks kept between redraws.

import { replyList } from './reply-list.js';
import { inspectReply } from './reply-view.js';

/**
 * What the Inspector widget reads (screens/inspector.js createInspectorWidget), over the host's store:
 * `createInspectorSource({ store, chat: () => messages, chatId?: () => id, problems?: index => [...] })` →
 * `{ replies(), reply(index), headIndex(), memory }`. `memory` keeps the reader's picks between redraws
 * for as long as the page is open: `index` (null follows the newest reply), `search`, `open` (the paths
 * folded open; the domains start open). It is the reader's view only, never saved.
 */
export function createInspectorSource({ store, chat = () => [], chatId = () => '', problems = () => [] }) {
    const memory = { index: null, search: '', open: new Set(['/domains']) };
    let seen = null;
    const headIndex = () => {
        try { return store.headIndex(); } catch { return null; }
    };
    return {
        memory,
        headIndex,
        replies() {
            // Another chat opened: a reply picked in the last one means nothing here.
            const id = String(chatId() ?? '');
            if (seen !== null && seen !== id) memory.index = null;
            seen = id;
            return replyList(chat(), { head: headIndex() });
        },
        reply: index => inspectReply({ store, chat: chat(), index, problems }),
    };
}
