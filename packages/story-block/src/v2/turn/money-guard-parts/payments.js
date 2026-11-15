// Reads what one receipt paid (a coin, with its source) or gained (an item for the party).

import { CAPTURE_PREFIX } from '../../registry-checks.js';

// The source of a payment, as the line wrote it: `from Master Vane's saddle-coffer (70 silver…)` → `master vane's saddle-coffer`.
export const sourceOf = note => String(note ?? '').replace(/^from\s+/iu, '').replace(/\(.*$/u, '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();

// A receipt that paid the party's wallet from a story line: { amount, now, source }, else null.
export function paidBy(receipt) {
    const data = receipt?.data;
    if (!String(receipt?.type ?? '').startsWith(CAPTURE_PREFIX) || !data || typeof data !== 'object') return null;
    if (!/ receives /u.test(String(receipt.summary ?? '')) || !Number.isSafeInteger(data.amount) || !Number.isSafeInteger(data.now)) return null;
    return { amount: data.amount, now: data.now, source: sourceOf(data.note) };
}

// A gained item as its receipt tells it: { def, qty, from, text } (the party gains ...), else null.
export function gainedBy(receipt) {
    const data = receipt?.data;
    if (receipt?.type !== `${CAPTURE_PREFIX}item` || !data || typeof data !== 'object' || data.owner !== 'party' || typeof data.def !== 'string' || !String(receipt.summary ?? '').startsWith('The party gains ')) return null;
    return { def: data.def, qty: data.qty, from: String(data.from ?? ''), text: receipt.summary };
}
