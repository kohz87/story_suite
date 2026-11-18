// Story Director v2, part screens: the per-chat Reveal choice for behind the scenes, remembered in this browser.

import { browserStore, stChatId } from './store.js';

export const MODULE_ID = 'story-director';
export const HIDE_SETTING = 'screens.hideBehind';

const STORE_KEY = 'story-director.reveal';
const ROOM = 200;

function liveSdk() {
    try {
        return globalThis.StoryBlock?.sdk ?? null;
    } catch {
        return null;
    }
}

/**
 * The reveal choice: `{ revealed(chatId?), set(on, chatId?), hidden({ sdk }), subscribe(fn) }`. `hidden`
 * is whether the open chat hides behind the scenes now (the setting on and not revealed). `deps`:
 * { store (browserStore), chatId () → id, settings () → the module's settings }.
 */
export function createReveal({ store = browserStore(), chatId = stChatId, settings = () => liveSdk()?.settings?.(MODULE_ID) ?? null } = {}) {
    const listeners = new Set();
    const read = () => {
        const value = store.get(STORE_KEY);
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    };
    const api = {
        guard() {
            let values = null;
            try { values = settings(); } catch { values = null; }
            return values?.[HIDE_SETTING] !== false;
        },
        revealed(id = chatId()) {
            return Object.hasOwn(read(), String(id ?? ''));
        },
        set(on, id = chatId()) {
            const key = String(id ?? '');
            const all = read();
            if (on) all[key] = 1;
            else delete all[key];
            // The oldest choices go past ROOM chats (object keys keep the order they were added in).
            const keys = Object.keys(all);
            for (const old of keys.slice(0, Math.max(0, keys.length - ROOM))) delete all[old];
            store.set(STORE_KEY, all);
            for (const fn of [...listeners]) {
                try { fn(); } catch { /* a widget that is gone */ }
            }
        },
        hidden() {
            return api.guard() && !api.revealed();
        },
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
    return api;
}

/** The page's reveal choice (the widgets share it). */
export const reveal = createReveal();
