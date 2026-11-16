// The viewer's Later (folded card) state, kept in storage per chat and card.

import { isRecord } from './shared-record.js';

const LATER_KEY = 'story-block.replyCards.later';

/**
 * The viewer's Later state: `laterStore(storage)` with storage { getItem, setItem } (localStorage by default). This page keeps its own
 * copy (read once), and each change is written to the storage when there is one; a storage that throws or holds junk is read as
 * nothing folded, and a change the storage refuses lasts this page only. Never throws.
 */
export function laterStore(storage) {
    let kept = null;
    // The default storage is read inside a try: a browser that refuses site data throws on `localStorage` itself.
    const area = () => {
        try { return storage === undefined ? globalThis.localStorage : storage; } catch { return null; }
    };
    const load = () => {
        if (kept) return kept;
        try {
            const parsed = JSON.parse(area()?.getItem?.(LATER_KEY) ?? '{}');
            kept = isRecord(parsed) ? parsed : {};
        } catch {
            kept = {};
        }
        return kept;
    };
    return {
        /** Whether the card (`${chatId}|${key}`: a chat and a card key, never a message index) is folded. */
        has: key => load()[key] === true,
        /** Folds (on) or opens the card. */
        set(key, on) {
            const all = load();
            if (on) all[key] = true;
            else delete all[key];
            try { area()?.setItem?.(LATER_KEY, JSON.stringify(all)); } catch { /* the choice lasts this page only */ }
        },
    };
}
