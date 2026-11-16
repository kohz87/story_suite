// Tells whether a legendary has been earned, from the reply being read or from the chat's record.

// Legendary from the story's own words: only when the same reply also completes a quest or wins a fight against a group at least 10
// levels above the party. Whoever knows that (the quests, the fights) answers `story.legendaryEarned` for the reply; nothing answering is no.
export function legendaryEarned(ctx) {
    try { if (ctx.query('story.legendaryEarned', {}) === true) return true; } catch { /* nothing answers */ }
    // The reply's own roll (the RPG, lean-rpg/gear.js earnedLegend): a won fight against a group 10+ levels above the party carries `legend: 1`.
    try { if (ctx.query('rpg.rolls', {})?.result?.legend === 1) return true; } catch { /* no roll this reply */ }
    // Once earned it lasts: any earlier roll of the chat's record with `legend: 1`, or a quest completed (`inventory.legendEarned`, derived from the record).
    try { return ctx.query('inventory.legendEarned', {}) === true; } catch { return false; }
}

/** Whether legendary has been earned in this chat's record up to the reply asking: a roll with `legend: 1` at or before it, or a quest the Director's threads say ended `done`. */
export function legendEarned(tools) {
    const upTo = Number.isInteger(tools?.reply?.index) ? tools.reply.index : Infinity;
    let entries = [];
    try { entries = tools?.receipts?.() ?? []; } catch { entries = []; }
    if (entries.some(entry => entry?.receipt?.type === 'rpg.resolve' && entry.receipt.data?.v2?.result?.legend === 1 && (!Number.isInteger(entry.index) || entry.index <= upTo))) return true;
    try {
        const threads = tools?.query?.('director.threads', { kind: 'quest' });
        return Array.isArray(threads) && threads.some(thread => thread?.kind === 'quest' && thread.ended?.outcome === 'done');
    } catch { return false; }
}
