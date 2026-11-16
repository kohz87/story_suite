/* NPC State Delta stored memories: the important-memory limit, the memory normalizer, the date stamps and their upkeep. */
import { durableSemanticSimilarity, DURABLE_PROFILE_LIMITS, semanticDedupeItems } from '../core-relationship.js';
import { cleanList, normalizeName } from '../core-text.js';

export const IMPORTANT_MEMORY_LIMIT = 5;

export function normalizeStoredMemories(value) {
    const cleaned = semanticDedupeItems(cleanList(value, 64, DURABLE_PROFILE_LIMITS.memory), {
        maxItems: 64,
        maxChars: DURABLE_PROFILE_LIMITS.memory,
        similarity: 0.58,
    });
    if (cleaned.length <= IMPORTANT_MEMORY_LIMIT) return cleaned;
    // Keep only the most recent bounded set after semantic dedupe.
    return cleaned.slice(-IMPORTANT_MEMORY_LIMIT);
}

// (memory dates) `memoryStamps`: a parallel map { normalized memory text: { m: reply index, d: story date text } } beside the memories list,
// whose own shape never changes. Only memories that are stored have an entry; one stored before this had none shows no date (never guessed).
export function normalizeMemoryStamps(value, memories) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const out = {};
    for (const text of Array.isArray(memories) ? memories : []) {
        const key = normalizeName(text);
        const stamp = key && Object.prototype.hasOwnProperty.call(source, key) ? source[key] : null;
        const message = Number(stamp?.m);
        if (!Number.isInteger(message) || message < 0) continue;
        const date = typeof stamp.d === 'string' ? stamp.d.trim().slice(0, 40) : '';
        const sid = typeof stamp.s === 'string' && stamp.s ? stamp.s : '';   // a `~ memory` line's reply marker (the per-reply cap) survives a rewrite of the record
        out[key] = { m: message, ...(date ? { d: date } : {}), ...(sid ? { s: sid } : {}) };
    }
    return Object.keys(out).length ? out : undefined;
}

// The stamps after a change from `before` to `after`: a kept memory keeps its stamp; a new one gets the reply it was recorded in and that reply's
// story date (`dateAt(message)`); one the merge only re-worded (similar to a memory that left) inherits the old stamp; a memory gone loses its.
export function stampMemories(before, after, message = null, dateAt = null) {
    const memories = Array.isArray(after?.memories) ? after.memories : [];
    const old = normalizeMemoryStamps(after?.memoryStamps ?? before?.memoryStamps, [...(Array.isArray(before?.memories) ? before.memories : []), ...memories]) ?? {};
    const had = new Set((Array.isArray(before?.memories) ? before.memories : []).map(normalizeName));
    // (memory facts) A fact's line keeps the reply it belongs to (and that reply's story date) and never inherits a stamp by similarity.
    const factOf = new Map(Object.values(after?.memoryFacts?.entries ?? {}).map(entry => [entry.t, entry]));
    const factOld = new Set(Object.values(before?.memoryFacts?.entries ?? {}).map(entry => entry.t));
    const gone = (Array.isArray(before?.memories) ? before.memories : []).filter(text => !factOld.has(normalizeName(text)) && !memories.some(item => normalizeName(item) === normalizeName(text)));
    const out = {};
    let date = null;
    for (const text of memories) {
        const key = normalizeName(text);
        if (!key) continue;
        if (old[key]) { out[key] = old[key]; continue; }
        const fact = factOf.get(key);
        if (fact) { const day = fact.d || String(dateAt?.(fact.r) ?? '').trim().slice(0, 40); out[key] = day ? { m: fact.r, d: day } : { m: fact.r }; continue; }
        if (had.has(key)) continue;   // stored before stamps existed: no date, never a guessed one
        const reworded = gone.find(item => durableSemanticSimilarity(item, text) >= 0.58);
        if (reworded) { const inherited = old[normalizeName(reworded)]; if (inherited) out[key] = inherited; continue; }   // an undated old memory stays undated
        if (!Number.isInteger(message) || message < 0) continue;
        date ??= String(dateAt?.(message) ?? '').trim().slice(0, 40);
        out[key] = date ? { m: message, d: date } : { m: message };
    }
    return Object.keys(out).length ? out : undefined;
}
