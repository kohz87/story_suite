// Applying the model's phrasing answers to the still-current handles after a merged response.
import { normalizeName } from '../../core-text.js';
import { validPhrasing } from '../memory-fact-text.js';
import { normalizeFacts } from '../memory-fact-ledger.js';
import { MAX_ATTEMPTS } from './limits.js';
import { locked } from './shared-locked.js';

// After a SUCCESSFULLY merged response: applies each valid sentence to the still-current handle, counts a try for the rest, stops offering after
// MAX_ATTEMPTS. `ok` false (failed, cut off, stale or never-dispatched call) changes nothing. Returns the new npcs list (original objects untouched).
export function applyPhrasing(npcs, handles, mem, { ok = true, fingerprintAt = () => null } = {}) {
    if (!ok || !Array.isArray(handles) || !handles.length) return npcs;
    const answers = mem && typeof mem === 'object' && !Array.isArray(mem) ? mem : {};
    let list = npcs;
    for (const handle of handles) {
        const index = list.findIndex(npc => npc.id === handle.npcId);
        const npc = list[index];
        const entry = npc?.memoryFacts?.entries?.[handle.key];
        const current = entry && entry.pend && entry.t === handle.tk && entry.rev === handle.rev && (entry.att ?? 0) === handle.att
            && !locked(npc) && !(npc.manualMemories || []).map(normalizeName).includes(entry.t) && fingerprintAt(entry.r) === handle.fp;
        if (!current) continue;
        const sentence = Object.hasOwn(answers, handle.h) ? validPhrasing(entry.k, entry.p, answers[handle.h]) : null;
        const next = structuredClone(npc);
        const slot = next.memories.findIndex(text => normalizeName(text) === entry.t);
        if (slot < 0) continue;
        const nextEntry = next.memoryFacts.entries[handle.key];
        if (sentence && !next.memories.some((text, at) => at !== slot && normalizeName(text) === normalizeName(sentence))) {
            const oldKey = entry.t;
            const newKey = normalizeName(sentence);
            next.memories[slot] = sentence;
            nextEntry.t = newKey;
            delete nextEntry.pend;
            delete nextEntry.att;
            if (next.memoryStamps?.[oldKey] && oldKey !== newKey) { next.memoryStamps[newKey] = next.memoryStamps[oldKey]; delete next.memoryStamps[oldKey]; }
        } else {
            nextEntry.att = (entry.att ?? 0) + 1;
            if (nextEntry.att >= MAX_ATTEMPTS) delete nextEntry.pend;
        }
        const checked = normalizeFacts(next.memoryFacts, next.memories);
        if (checked) next.memoryFacts = checked; else delete next.memoryFacts;
        list = list.map((item, at) => (at === index ? next : item));
    }
    return list;
}
