// Story Suite v2: the text hash and the payload text (the reply up to its change block).

// 32-bit FNV-1a, as 8 hex digits: enough to tell two swipes' openings apart (and two change lines).
export function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/**
 * The text of the shown swipe a guarded block takes as its evidence payload: the reply as written, up to its
 * <Changes> block (or the hidden comment that holds it once it is read), without trailing space. Markup in the
 * prose (a status panel, reasoning tags) is part of it. It changes when the reply is edited or continued, which
 * is what makes a stored payload hash stale (store.js sourceAt, REPLAY.md). Cached per message by its text.
 */
export function payloadText(message) {
    const mes = String(message?.mes ?? '');
    const at = mes.search(/<Changes\b|<!--\s*STORY_SUITE_V2\b/i);
    return (at < 0 ? mes : mes.slice(0, at)).trimEnd();
}
