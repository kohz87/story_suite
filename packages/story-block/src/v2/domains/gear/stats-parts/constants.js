// Gear's constants: the slots, places, stats, rarity budgets, carry numbers and limits.

export const GEAR = Object.freeze({
    // The slots a piece can occupy; every one gives its stats.
    slots: Object.freeze(['weapon', 'body', 'off-hand', 'head', 'cloak', 'feet', 'accessory']),
    // The keys a worn piece is filed under (accessories have two places).
    places: Object.freeze(['weapon', 'body', 'off-hand', 'head', 'cloak', 'feet', 'accessory-1', 'accessory-2']),
    // The seven stats a piece can raise, and the one each slot raises when nothing else says.
    stats: Object.freeze(['STR', 'VIT', 'AGI', 'DEX', 'INT', 'LUK', 'CHA']),
    slotStat: Object.freeze({ weapon: 'STR', body: 'VIT', 'off-hand': 'VIT', head: 'VIT', cloak: 'AGI', feet: 'AGI', accessory: 'LUK' }),
    // The total stat points a rarity gives (Plan A: stats stay 1–20, so gear stays small).
    budget: Object.freeze({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }),
    // A pack item's own `bonus` is its budget instead, 0…6 (the Studio / a pack only).
    bonusMax: 6,
    // A stat with gear added up may pass 20 but never this (part 2 holds the effective stat to it).
    effectiveMax: 30,
    // A piece raises at most this many different stats.
    maxStats: 2,
    // The story's own words reach `epic` at most; legendary comes from a pack or a module's reward.
    storyRarityMax: 'epic',
    // Carry: capacity = base + perStr × STR (STR 1…20) + what is worn; a thing weighs 1 per unit, coins are free.
    // Soak (Combat rules v1, decisions 36.7/38.5, the approved mock: party.html soakOf): each piece has its own soak (its definition's `soak`: a pack's, the reader's Edit, or a story line's
    // `soak: N`; default 0), held by code to its slot's cap, so a story line cannot mint it: body 2, off-hand 2, head 1, cloak, feet and accessory 0. 1 point = 1 % of damage. A piece in a
    // worse state than `minCond` (the Worn word's floor: torn and broken pieces) gives none. A member's soak is VIT + the pieces' soak, at most `max`. No other gear bonus counts (BATCH1 B1.5 stays closed).
    soak: Object.freeze({ caps: Object.freeze({ body: 2, 'off-hand': 2, head: 1, cloak: 0, feet: 0, accessory: 0 }), capMax: 2, max: 50, minCond: 40 }),
    carry: Object.freeze({ base: 10, perStr: 2, strMin: 1, strMax: 20, strDefault: 10 }),
});
