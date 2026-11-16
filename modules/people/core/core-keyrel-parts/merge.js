/* NPC State Delta key-relationship merging: subject equivalence and merging updates into a person's list, evicting the weakest tie when full. */
import { normalizeName } from '../core-text.js';
import { KEY_RELATIONSHIP_LIMIT, compactKeyRelationshipEntry, keyRelationshipSubject } from './entries.js';
import { readTieRows } from './tie-rows.js';

export function keyRelationshipSubjectsEquivalent(a, b) {
    const left = keyRelationshipSubject(a);
    const right = keyRelationshipSubject(b);
    if (!left || !right) return false;
    if (left === right) return true;
    const leftTokens = left.split(/\s+/).filter(Boolean);
    const rightTokens = right.split(/\s+/).filter(Boolean);
    if (Math.min(leftTokens.length, rightTokens.length) < 1) return false;
    const short = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
    const long = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
    return short.length >= 1 && short.every(token => long.includes(token)) && short.join(' ').length >= 4;
}

export function mergeKeyRelationshipUpdates(existing, incoming, tieState = null) {
    const current = (Array.isArray(existing) ? existing : []).slice(0, KEY_RELATIONSHIP_LIMIT * 2)
        .map(compactKeyRelationshipEntry).filter(Boolean).slice(0, KEY_RELATIONSHIP_LIMIT);
    const updates = (Array.isArray(incoming) ? incoming : []).slice(0, KEY_RELATIONSHIP_LIMIT * 2)
        .map(compactKeyRelationshipEntry).filter(Boolean);
    for (const entry of updates) {
        const exact = normalizeName(entry);
        let index = current.findIndex(item => keyRelationshipSubjectsEquivalent(item, entry));
        if (index < 0 && exact) index = current.findIndex(item => normalizeName(item) === exact);
        if (index >= 0) current[index] = entry;
        else if (current.length < KEY_RELATIONSHIP_LIMIT) current.push(entry);
        else if (tieState) {
            // Full list and this person records ties' last mentions: the new tie takes the place of the weakest, least recently mentioned one.
            const victim = tieEvictionIndex(current, tieState);
            if (victim >= 0) current[victim] = entry;
        }
    }
    return current.slice(0, KEY_RELATIONSHIP_LIMIT);
}

// The victim when the list is full: the lowest-priority tier first, inside it the least recently mentioned (no mention recorded counts
// as the oldest). A list the reader edited by hand (`tieState.manual`) is never touched; -1 = nobody to replace (the new tie is dropped).
function tieEvictionIndex(current, tieState) {
    if (tieState.manual) return -1;
    const rows = readTieRows({ keyRelationships: current, tieSeen: tieState.seen ?? {} }, { npcs: tieState.npcs, day: null, tags: tieState.tags });
    const weakest = rows.at(-1);
    return weakest ? weakest.index : -1;
}
