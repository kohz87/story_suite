// The suppression ledger rows: cleaning stored rows, pruning whole boundary groups and finding a key's row.
import { LEDGER_CAP } from './limits.js';
import { isFactKey, nonNegative } from './shared-checks.js';

const DISPOSITIONS = 'kexlcoq';

export function cleanLedger(raw) {
    const rows = [];
    const seen = new Set();
    for (const row of Array.isArray(raw?.keys) ? raw.keys : []) {
        if (!Array.isArray(row) || !isFactKey(row[0]) || seen.has(row[0])) continue;
        const boundary = nonNegative(row[1]);
        if (boundary === null || !DISPOSITIONS.includes(row[2]) || row[2].length !== 1) continue;
        seen.add(row[0]);
        rows.push([row[0], boundary, row[2], String(row[3] || '').slice(0, 12)]);
    }
    return { floor: nonNegative(raw?.floor) ?? 0, keys: rows };
}

// Prunes whole boundary groups, oldest first, and advances the floor over each; never splits a boundary.
export function pruneLedger(ledger, cap = LEDGER_CAP) {
    const keys = [...ledger.keys].sort((a, b) => a[1] - b[1]);
    let floor = ledger.floor;
    while (keys.length > cap) {
        const boundary = keys[0][1];
        while (keys.length && keys[0][1] === boundary) keys.shift();
        floor = Math.max(floor, boundary);
    }
    return { floor, keys };
}

export const ledgerRow = (facts, key) => facts?.ledger?.keys?.find(row => row[0] === key) ?? null;
