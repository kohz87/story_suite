// Builds the ambush a roll's checks made and the ambush part of its result record.

/** The ambush the roll's checks made: `{ who, skill, outcome, total, dc, success }`, or null when no check of the roll carries `ambush`. */
export function ambushOf(checks, drop = null, acts = true) {
    const line = (Array.isArray(checks) ? checks : []).find(item => item?.ambush === true);
    // With no act to strike with in this roll the check's line says the party has the drop (for the next reply), not that it strikes first.
    if (line && !acts) line.ambushDrop = true;
    if (!line) return drop && acts ? { ...drop, outcome: 'success', success: true, carried: true } : null;
    return { who: line.pc.who, skill: line.skill ?? null, outcome: line.outcome, total: line.pc.total, dc: line.dc, success: line.outcome === 'success' };
}

/**
 * The ambush part of a roll's result: `{ ambush }` or nothing. A roll with a fight tells it (a carried one is marked `spent`); a roll with no acts
 * to strike with and a successful ambush check keeps it as `drop: true` for the next reply (ambush.js carriedFrom), and its check line says the party has the drop.
 */
export function ambushRecord(ambush, _checks, fight) {
    if (!ambush) return {};
    if (fight.some(entry => entry.kind === 'act')) return { ambush: { ...ambush, ...(ambush.carried ? { spent: true } : {}) } };
    return { ambush: { ...ambush, ...(ambush.success ? { drop: true } : {}) } };
}
