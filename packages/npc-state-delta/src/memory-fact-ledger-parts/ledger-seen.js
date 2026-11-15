// Whether an event was already seen (kept, tombstoned or below the floor) and recording a disposition for a key.
import { pruneLedger, ledgerRow } from './ledger-rows.js';

// Seen = tombstoned, retained, or at/below the pruned floor: the event may not be recreated.
export function factSeen(facts, key, boundary) {
    if (!facts) return false;
    if (ledgerRow(facts, key) || facts.entries?.[key]) return true;
    return facts.ledger?.floor > 0 && boundary <= facts.ledger.floor;
}

export function withDisposition(facts, key, boundary, disposition, identity = '') {
    const base = facts ?? { v: 1, entries: {}, ledger: { floor: 0, keys: [] } };
    const keys = base.ledger.keys.filter(row => row[0] !== key);
    keys.push([key, boundary, disposition, identity]);
    return { v: 1, entries: base.entries, ledger: pruneLedger({ floor: base.ledger.floor, keys }) };
}
