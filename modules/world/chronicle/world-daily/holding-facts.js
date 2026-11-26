// World events: which of the holding's two facts count, asked of the holding as it stands now. The ledger and the daily step only remember
// the day a fact began; a fact whose holding is gone (its founding reply deleted), or whose seat is gone, counts nowhere. Pure.

const FOUNDED = 'fact:pc-holding-founded';
const SEATED = 'fact:pc-seat-claimed';

/** The facts this holding supports (`holding`: the `dataModules.holding` answer, null before a founding or while it is off). */
export function holdingFacts(holding) {
    if (!holding) return [];
    return [FOUNDED, ...(String(holding.seat ?? '').trim() ? [SEATED] : [])];
}

/** The holding facts that do not count now: a remembered day under one of these keys is passed over. `query(name, args)` asks the engine. */
export function unheldFacts(query) {
    let holding = null;
    try { holding = query?.('dataModules.holding', {}) ?? null; } catch { holding = null; }
    const held = holdingFacts(holding);
    return [FOUNDED, SEATED].filter(key => !held.includes(key));
}
