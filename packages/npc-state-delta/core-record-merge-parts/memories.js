/* Important Memory merging: same-reply retelling detection, pinned-memory protection and retention-ranked selection. */
import { durableRefinementTokens, DURABLE_PROFILE_LIMITS, durableSemanticSimilarity, semanticDedupeItems } from '../core-relationship.js';
import { cleanList, normalizeName } from '../core-text.js';
import { IMPORTANT_MEMORY_LIMIT } from '../core-record-shared.js';

// A second pass over a reply already recorded (a new person's backfill or fill reads the reply the one-pass scan just stored) re-tells
// that reply's memory in other words, too far apart for the similarity rule ("Registered Astra ... bodice button snapped ... culling
// contracts" against "Took Astra's registration fee ... bodice burst open ... culling contracts", about 0.2 against 0.58). Narrow on purpose:
// only a new memory, against a stored memory stamped at the SAME reply (same message id), never a hand-written (pinned) one, sharing
// three or more distinctive words (4+ letters, proper names and places left out: they recur in every memory of a person) that are at
// least a quarter of the shorter memory's words, is that event again and is not stored. Another reply, or a near-similar but different event, is kept.
function distinctWords(text) {
    const names = new Set();
    for (const hit of String(text || '').matchAll(/[A-Z][a-z]+/g)) {
        if (hit.index > 0 && !/[.!?]\s*$/.test(String(text).slice(0, hit.index))) names.add(hit[0].toLowerCase());
    }
    return new Set(durableRefinementTokens(text).filter(token => token.length >= 4 && !/^\d+$/.test(token) && !names.has(token)));
}
export function sameReplyRetelling(item, oldList = [], stamps = {}, message = null, pinned = []) {
    if (!Number.isInteger(message)) return false;
    const keep = new Set((Array.isArray(pinned) ? pinned : []).map(normalizeName));
    if (keep.has(normalizeName(item))) return false;
    const words = distinctWords(item);
    return (Array.isArray(oldList) ? oldList : []).some(old => {
        if (stamps?.[normalizeName(old)]?.m !== message || keep.has(normalizeName(old))) return false;
        const oldWords = distinctWords(old);
        const shared = [...oldWords].filter(word => words.has(word)).length;
        return shared >= 3 && shared / Math.min(oldWords.size, words.size) >= 0.25;
    });
}

// (cleanup step 6) Memories the reader entered by hand (`pinned`, the record's manualMemories) are
// never evicted: new ones take only the slots the reader's own leave free. `sameReply` ({ stamps, message }) drops re-tellings (above).
export function mergeImportantMemories(oldList, newList, retentionList = [], incomingLimit = 3, pinned = [], sameReply = {}) {
    const fresh = (Array.isArray(newList) ? newList : []).filter(item => !sameReplyRetelling(item, oldList, sameReply.stamps, sameReply.message, pinned));
    const merged = mergeUnpinnedMemories(oldList, fresh, retentionList, incomingLimit);
    const keep = (Array.isArray(pinned) ? pinned : []).map(normalizeName).filter(Boolean);
    if (!keep.length) return merged;
    const isPinned = item => keep.includes(normalizeName(item));
    const existing = cleanList(oldList, 64, DURABLE_PROFILE_LIMITS.memory);
    const missing = existing.filter(item => isPinned(item) && !merged.some(other => normalizeName(other) === normalizeName(item)));
    if (!missing.length) return merged;
    const order = [...existing, ...merged.filter(item => !existing.some(other => normalizeName(other) === normalizeName(item)))];
    const chosen = new Set([...merged, ...missing].map(normalizeName));
    const out = order.filter(item => chosen.has(normalizeName(item)));
    // Too many: drop the oldest memories the reader did not write.
    while (out.length > IMPORTANT_MEMORY_LIMIT) {
        const at = out.findIndex(item => !isPinned(item));
        if (at < 0) break;
        out.splice(at, 1);
    }
    return out.slice(-IMPORTANT_MEMORY_LIMIT);
}

function mergeUnpinnedMemories(oldList, newList, retentionList = [], incomingLimit = 3) {
    const existing = semanticDedupeItems(cleanList(oldList, 64, DURABLE_PROFILE_LIMITS.memory), {
        maxItems: 64, maxChars: DURABLE_PROFILE_LIMITS.memory, similarity: 0.58,
    });
    const limit = Math.max(1, Math.min(IMPORTANT_MEMORY_LIMIT, Math.round(Number(incomingLimit) || 3)));
    const incoming = semanticDedupeItems(cleanList(newList, Math.max(6, limit * 2), DURABLE_PROFILE_LIMITS.memory), {
        maxItems: limit, maxChars: DURABLE_PROFILE_LIMITS.memory, similarity: 0.58,
    });
    const pool = semanticDedupeItems([...existing, ...incoming], {
        maxItems: 64, maxChars: DURABLE_PROFILE_LIMITS.memory, similarity: 0.58,
    });
    if (pool.length <= IMPORTANT_MEMORY_LIMIT) return pool;

    const requested = semanticDedupeItems(cleanList(retentionList, IMPORTANT_MEMORY_LIMIT * 2, DURABLE_PROFILE_LIMITS.memory), {
        maxItems: IMPORTANT_MEMORY_LIMIT, maxChars: DURABLE_PROFILE_LIMITS.memory, similarity: 0.58,
    });
    const selected = [];
    const selectCanonical = request => {
        let best = null;
        let bestScore = 0;
        for (const candidate of pool) {
            const score = normalizeName(candidate) === normalizeName(request) ? 1 : durableSemanticSimilarity(candidate, request);
            if (score > bestScore) { best = candidate; bestScore = score; }
        }
        return bestScore >= 0.56 ? best : null;
    };
    for (const item of requested) {
        const canonical = selectCanonical(item);
        if (!canonical || selected.some(value => durableSemanticSimilarity(value, canonical) >= 0.58)) continue;
        selected.push(canonical);
    }

    if (selected.length) {
        // A partial/malformed model selection must not re-lock the list. Fill any
        // missing slots with newest semantically distinct memories first.
        for (const item of [...incoming, ...existing].reverse()) {
            if (selected.some(value => durableSemanticSimilarity(value, item) >= 0.58)) continue;
            selected.push(item);
            if (selected.length >= IMPORTANT_MEMORY_LIMIT) break;
        }
        return selected.slice(0, IMPORTANT_MEMORY_LIMIT);
    }

    // Scanner omitted semantic retention. Prefer the newest five distinct events.
    return pool.slice(-IMPORTANT_MEMORY_LIMIT);
}
