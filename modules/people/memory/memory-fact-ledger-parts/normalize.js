// The sidecar normalizer: stored facts checked against the visible memories, detached entries tombstoned.
import { normalizeName } from '../../core/core-text.js';
import { cleanPayload, productions, FACT_KINDS } from '../memory-fact-text.js';
import { FACT_SLOTS, PAYLOAD_BYTES } from './limits.js';
import { isFactKey, nonNegative } from './shared-checks.js';
import { cleanLedger, pruneLedger } from './ledger-rows.js';

const CLASSES = ['M', 'A', 'O'];

function cleanEntry(key, raw) {
    if (!isFactKey(key) || !raw || typeof raw !== 'object') return null;
    const kind = FACT_KINDS.includes(raw.k) ? raw.k : '';
    const payload = kind ? cleanPayload(kind, raw.p) : null;
    const r = nonNegative(raw.r);
    if (!payload || r === null || !CLASSES.includes(raw.c)) return null;
    if (new TextEncoder().encode(JSON.stringify(payload)).length > PAYLOAD_BYTES) return null;
    const entry = { t: String(raw.t || ''), r, s: String(raw.s || '').slice(0, 120), rev: String(raw.rev || '').slice(0, 16), k: kind, c: raw.c, p: payload, i: String(raw.i || '').slice(0, 12) };
    if (typeof raw.d === 'string' && raw.d.trim()) entry.d = raw.d.trim().slice(0, 40);
    if (raw.pend) entry.pend = 1;
    if (Number.isInteger(raw.att) && raw.att > 0) entry.att = Math.min(raw.att, 9);
    return entry;
}

// Sidecar from stored data against the visible memories: an entry stays only while exactly one stored memory still carries its text and
// that text is one of its allowed sentences. Any other entry is detached and its key tombstoned (`x`), the reader's text untouched.
export function normalizeFacts(raw, memories) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const ledger = cleanLedger(raw.ledger);
    const entries = {};
    const slots = new Map();
    for (const text of Array.isArray(memories) ? memories : []) {
        const tk = normalizeName(text);
        slots.set(tk, slots.has(tk) ? null : text);
    }
    const dropped = [];
    for (const [key, value] of Object.entries(raw.entries && typeof raw.entries === 'object' ? raw.entries : {})) {
        const entry = cleanEntry(key, value);
        const text = entry ? slots.get(entry.t) : null;
        if (!entry || !text || !productions(entry.k, entry.p).includes(text.normalize('NFC')) || Object.keys(entries).length >= FACT_SLOTS) { dropped.push([key, entry]); continue; }
        entries[key] = entry;
    }
    let next = ledger;
    for (const [key, entry] of dropped) {
        if (!isFactKey(key) || next.keys.some(row => row[0] === key && row[2] !== 'k')) continue;
        next = { floor: next.floor, keys: [...next.keys.filter(row => row[0] !== key), [key, entry?.r ?? 0, 'x', entry?.i ?? '']] };
    }
    for (const key of Object.keys(entries)) {
        if (!next.keys.some(row => row[0] === key)) next = { floor: next.floor, keys: [...next.keys, [key, entries[key].r, 'k', entries[key].i]] };
    }
    next = pruneLedger(next);
    if (!Object.keys(entries).length && !next.keys.length && !next.floor) return undefined;
    return { v: 1, entries, ledger: next };
}
