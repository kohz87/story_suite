// Story Director v2, part screens: the reader's device-wide spoiler choice (stored in the browser, page memory as fallback).

export const SPOILER_STORE = 'story-director.spoilers';

function browserStorage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** A reader's device-wide choice. It is read from storage on every draw (so a tab opened earlier follows a change made in
 *  another tab), with a page-memory fallback if storage is blocked or a write fails. */
export function createSpoilerPreference({ storage = browserStorage(), win = globalThis } = {}) {
    let memory = true;
    let writeFailed = false;
    const listeners = new Set();
    const notify = () => { for (const fn of [...listeners]) { try { fn(); } catch { /* an unavailable view */ } } };
    const onStorage = event => { if (!event || event.key == null || event.key === SPOILER_STORE) notify(); };
    try { win?.addEventListener?.('storage', onStorage); } catch { /* no cross-tab events here */ }
    return {
        shown() {
            if (writeFailed) return memory;
            try {
                const saved = storage?.getItem?.(SPOILER_STORE);
                if (saved === 'hidden' || saved === 'shown') memory = saved === 'shown';
            } catch { /* keep the page's choice */ }
            return memory;
        },
        set(on) {
            memory = on === true;
            try { storage?.setItem?.(SPOILER_STORE, memory ? 'shown' : 'hidden'); writeFailed = false; } catch { writeFailed = true; }
            notify();
        },
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    };
}

export const spoilerPreference = createSpoilerPreference();
