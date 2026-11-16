// The whole fact-aware merge of one dossier's memories (ordinary memories compete for the slots pins and facts leave).
import { cleanList, normalizeName } from '../../core-text.js';
import { DURABLE_PROFILE_LIMITS, durableSemanticSimilarity } from '../../core-relationship.js';
import { mergeImportantMemories } from '../../core-record-merge.js';
import { fallbackText } from '../memory-fact-text.js';
import { FACT_SLOTS, isFactKey, withDisposition } from '../memory-fact-ledger.js';
import { admitCandidates } from './admit.js';
import { chooseSlots, stable } from './slots.js';
import { normalizeFactMemories } from './normalize.js';

// The whole fact-aware merge of one dossier's memories. `incoming` are the model's ordinary memories (suppressed only on EXACT text equality
// against a pin or fact; ordinary-to-ordinary keeps today's semantic merge); `candidates` are code-derived facts, their fallback text written here.
export function mergeFactMemories({ memories = [], manual = [], facts, incoming = [], retention = [], incomingLimit = 3, candidates = [], locked = false, message = null, stamps = {} } = {}) {
    const start = normalizeFactMemories(memories, facts, manual);
    const current = start.memories;
    const pinSet = new Set((Array.isArray(manual) ? manual : []).map(normalizeName));
    const factText = new Set(Object.values(start.facts?.entries ?? {}).map(entry => entry.t));
    const { admitted, facts: afterAdmit } = admitCandidates(candidates, start.facts, { locked });
    let next = afterAdmit;
    // Ordinary memories: today's merge over the unpinned, non-fact ones only; an exact collision with a pin or fact text is dropped.
    const ordinaryOld = current.filter(text => !pinSet.has(normalizeName(text)) && !factText.has(normalizeName(text)));
    const blocked = new Set([...pinSet, ...factText, ...admitted.map(item => normalizeName(fallbackText(item.kind, item.payload)))]);
    const ordinaryNew = cleanList(incoming, 12, DURABLE_PROFILE_LIMITS.memory).filter(text => !blocked.has(normalizeName(text)));
    const ordinary = locked ? ordinaryOld : mergeImportantMemories(ordinaryOld, ordinaryNew, retention, incomingLimit, [], { stamps, message });
    const records = [];
    let order = 0;
    for (const text of current) {
        const tk = normalizeName(text);
        const found = Object.entries(next?.entries ?? {}).find(([, entry]) => entry.t === tk);
        if (found) records.push({ text, tk, pin: pinSet.has(tk), key: found[0], entry: found[1], order: order++ });
        else if (pinSet.has(tk)) records.push({ text, tk, pin: true, order: order++ });
    }
    const ordinaryRecords = ordinary.map(text => ({ text, tk: normalizeName(text), pin: false, order: current.indexOf(text) >= 0 ? current.indexOf(text) : 1000 + order++ }));
    records.push(...ordinaryRecords.filter(item => !records.some(other => other.tk === item.tk)));
    const taken = new Set(records.map(item => item.tk));
    const fresh = [];
    for (const candidate of [...admitted].sort((a, b) => a.R - b.R || (a.key < b.key ? -1 : 1))) {   // chronological: the list reads oldest first
        const text = fallbackText(candidate.kind, candidate.payload);
        const tk = normalizeName(text);
        if (!text || taken.has(tk)) { next = withDisposition(next, candidate.key, candidate.R, 'c', candidate.ident); continue; }   // display collision: one slot, one identity
        taken.add(tk);
        const entry = { t: tk, r: candidate.R, s: String(candidate.source || '').slice(0, 120), rev: String(candidate.rev || '').slice(0, 16), k: candidate.kind, c: candidate.cls, p: candidate.payload, i: candidate.ident, pend: 1 };
        if (typeof candidate.date === 'string' && candidate.date.trim()) entry.d = candidate.date.trim().slice(0, 40);
        fresh.push({ text, tk, pin: false, key: candidate.key, entry, order: 2000 + order++ });
    }
    records.push(...fresh);
    // Ordinary memories compete for the slots the pins and facts leave: the model's retention ranks them (as the legacy merge did), newest last.
    const slotsLeft = FACT_SLOTS - records.filter(item => item.pin || item.entry).length;
    const ordinarySelected = new Set(chooseOrdinary(records.filter(item => !item.pin && !item.entry), Math.max(0, slotsLeft), retention).map(item => item.tk));
    const pool = records.filter(item => item.pin || item.entry || ordinarySelected.has(item.tk));
    const chosen = chooseSlots(pool);
    const entries = { ...(next?.entries ?? {}) };
    for (const item of records) {
        if (!item.key) continue;
        if (chosen.includes(item)) { entries[item.key] = item.entry; if (!next?.ledger?.keys?.some(row => row[0] === item.key && row[2] === 'k')) next = withDisposition(next, item.key, item.entry.r, 'k', item.entry.i); }
        else { delete entries[item.key]; next = withDisposition(next, item.key, item.entry.r, 'e', item.entry.i); }
    }
    const kept = stable(records, chosen);
    for (const key of Object.keys(entries)) if (!kept.some(item => item.key === key)) delete entries[key];
    const out = next ? { v: 1, entries, ledger: next.ledger } : undefined;
    const clean = out && (Object.keys(out.entries).length || out.ledger.keys.length || out.ledger.floor) ? out : undefined;
    return { memories: kept.map(item => item.text), manual: kept.filter(item => item.pin).map(item => item.text), facts: clean, facted: kept.filter(item => item.entry && !item.pin).map(item => item.key) };
}

function chooseOrdinary(list, count, retention) {
    if (list.length <= count) return list;
    const wanted = cleanList(retention, 10, DURABLE_PROFILE_LIMITS.memory);
    const requested = list.filter(item => wanted.some(request => normalizeName(request) === item.tk || durableSemanticSimilarity(request, item.text) >= 0.56));
    const rest = list.filter(item => !requested.includes(item)).sort((a, b) => b.order - a.order);
    return [...requested, ...rest].slice(0, count);
}

export { isFactKey };
