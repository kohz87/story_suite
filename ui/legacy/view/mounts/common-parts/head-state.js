// Mounts: reading the document and the head state out of the shared dependencies.

export const documentOf = deps => deps.document ?? globalThis.document;

// A chat with no reply that keeps the story (at boot, before the chat opens, or only a greeting) has
// head index -1: an empty state (null) and no index, never a store.at(-1) RangeError.
export function headState(deps) {
    if (typeof deps.head === 'function') return deps.head();
    if (typeof deps.stateAt === 'function' && typeof deps.headIndex === 'function') {
        const index = deps.headIndex();
        return Number.isInteger(index) && index >= 0 ? deps.stateAt(index) : null;
    }
    throw new TypeError('A mount needs head() or stateAt(index) with headIndex().');
}

export const headIndexOf = deps => {
    const index = typeof deps.headIndex === 'function' ? deps.headIndex() : null;
    return Number.isInteger(index) && index < 0 ? null : index;
};

/** The head state the mounts show, or null (no chat, no story yet). */
export const headStateSafe = deps => {
    try { return headState(deps); } catch { return null; }
};
