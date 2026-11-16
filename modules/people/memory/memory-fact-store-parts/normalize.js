// Stored memories that carry a sidecar: exact-text dedupe, the sidecar validated against them, then the slot order.
import { cleanList, normalizeName } from '../../core-text.js';
import { DURABLE_PROFILE_LIMITS } from '../../core-relationship.js';
import { normalizeFacts, withDisposition } from '../memory-fact-ledger.js';
import { chooseSlots, stable } from './slots.js';

// Stored memories carrying a sidecar: exact-text dedupe only (never semantic), the sidecar validated against them, then the slot order.
export function normalizeFactMemories(rawMemories, rawFacts, rawManual = []) {
    const seen = new Set();
    const texts = cleanList(rawMemories, 64, DURABLE_PROFILE_LIMITS.memory).filter(text => { const k = normalizeName(text); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    let facts = normalizeFacts(rawFacts, texts);
    const manual = new Set((Array.isArray(rawManual) ? rawManual : []).map(normalizeName));
    const byText = new Map(Object.entries(facts?.entries ?? {}).map(([key, entry]) => [entry.t, { key, entry }]));
    const records = texts.map((text, order) => ({ text, tk: normalizeName(text), pin: manual.has(normalizeName(text)), order, ...(byText.get(normalizeName(text)) ?? {}) }));
    const chosen = chooseSlots(records);
    for (const item of records) if (!chosen.includes(item) && item.key) facts = withDisposition(facts, item.key, item.entry.r, 'e', item.entry.i);
    const kept = stable(records, chosen);
    for (const item of records) if (!chosen.includes(item) && item.key && facts?.entries?.[item.key]) { delete facts.entries[item.key]; }
    return { memories: kept.map(item => item.text), facts: facts && (Object.keys(facts.entries).length || facts.ledger.keys.length || facts.ledger.floor) ? facts : undefined };
}
