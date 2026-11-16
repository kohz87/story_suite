// Priority-order selection of the five memory slots and the stable restore of record order.
import { FACT_SLOTS } from '../memory-fact-ledger.js';

const RANK = { M: 1, A: 2, O: 3 };

// Priority-order selection of at most `limit` records. Each record { text, tk, pin, key?, entry?, order }; returns the kept records.
export function chooseSlots(records, limit = FACT_SLOTS) {
    const pins = records.filter(item => item.pin);
    if (pins.length >= limit) return pins;                       // five pins leave nothing: automatic writers never evict a pin (>5 stays untouched)
    const rest = records.filter(item => !item.pin);
    const firstMeeting = rest.filter(item => item.entry?.c === 'M').sort((a, b) => a.entry.r - b.entry.r || (a.key < b.key ? -1 : 1))[0];
    const rank = item => (item === firstMeeting ? 1 : (item.entry ? Math.max(2, RANK[item.entry.c] ?? 3) : 4));
    const ordered = rest.filter(item => !item.entry || item.entry.c !== 'M' || item === firstMeeting)
        .sort((a, b) => rank(a) - rank(b) || (rank(a) === 4 ? b.order - a.order : (b.entry.r - a.entry.r || (a.key < b.key ? -1 : 1))));
    return [...pins, ...ordered.slice(0, limit - pins.length)];
}

export function stable(records, chosen) { return records.filter(item => chosen.includes(item)).sort((a, b) => a.order - b.order); }
