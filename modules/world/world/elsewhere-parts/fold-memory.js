// The remembered fold state of the World sections, per chat, kept in the page's storage.

import { isRecord } from './shared-guards.js';

export const FOLD_STORE = 'story-director.world.folds';

/**
 * The remembered folds on `storage` (default: the page's localStorage), as `get(key)` → true | false | null and
 * `set(key, open)`. Stored as one JSON object under FOLD_STORE. Every access is guarded: a blocked storage, or a
 * damaged value, falls back to the page's own copy.
 */
export function foldMemory(storage = defaultStorage()) {
    const page = new Map();
    const read = () => {
        try {
            const raw = storage?.getItem?.(FOLD_STORE);
            const got = typeof raw === 'string' ? JSON.parse(raw) : null;
            return isRecord(got) ? got : {};
        } catch {
            return {};
        }
    };
    return {
        get(key) {
            if (page.has(key)) return page.get(key);
            const got = read()[key];
            return typeof got === 'boolean' ? got : null;
        },
        set(key, open) {
            page.set(key, open === true);
            try {
                const all = read();
                all[key] = open === true;
                storage?.setItem?.(FOLD_STORE, JSON.stringify(all));
            } catch { /* storage blocked or full: the page keeps it */ }
        },
    };
}

function defaultStorage() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}
