// Story Director v2, part screens: the browser's storage (with memory fallback) and the open SillyTavern chat's id.

/** The open chat's id from SillyTavern (a group chat's too), or '' when there is none. */
export function stChatId() {
    try {
        const st = globalThis.SillyTavern?.getContext?.();
        const id = typeof st?.getCurrentChatId === 'function' ? st.getCurrentChatId() : st?.chatId;
        return id === undefined || id === null ? '' : String(id);
    } catch {
        return '';
    }
}

/** The browser's storage as `{ get(key), set(key, value) }` (JSON), or memory when it cannot be used. */
export function browserStore(storage = null) {
    const memory = new Map();
    const area = () => {
        try {
            return storage ?? globalThis.localStorage ?? null;
        } catch {
            return null;
        }
    };
    return {
        get(key) {
            try {
                const raw = area()?.getItem?.(key);
                if (typeof raw === 'string') return JSON.parse(raw);
            } catch { /* storage blocked or the value damaged: memory's copy */ }
            return memory.has(key) ? structuredClone(memory.get(key)) : null;
        },
        set(key, value) {
            memory.set(key, structuredClone(value));
            try { area()?.setItem?.(key, JSON.stringify(value)); } catch { /* memory keeps it for this page */ }
        },
    };
}
