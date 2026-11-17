// Story Suite v2: the Problems list kept with the chat (its metadata, `storySuiteProblems`), so a reload of the page shows the same rows.

const KEY = 'storySuiteProblems';
const MAX_KEPT = 100;

/** The rows kept with the chat (plain copies, oldest first); none when the chat has none. */
export function keptProblems(holder) {
    const rows = holder?.[KEY];
    return Array.isArray(rows) ? rows.filter(row => row && typeof row === 'object' && !Array.isArray(row)).map(row => ({ ...row })) : [];
}

/** Writes the last MAX_KEPT rows of `log` into `holder`; → true when the kept rows changed (the caller then saves the metadata). */
export function keepProblems(holder, log) {
    if (!holder || typeof holder !== 'object') return false;
    let next;
    try { next = JSON.parse(JSON.stringify(log.slice(-MAX_KEPT))); } catch { return false; }
    const same = JSON.stringify(holder[KEY] ?? []) === JSON.stringify(next);
    if (same) return false;
    if (next.length) holder[KEY] = next;
    else delete holder[KEY];
    return true;
}
