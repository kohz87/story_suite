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
    carry: Object.freeze({ base: 10, perStr: 2, strMin: 1, strMax: 20, strDefault: 10 }),
});
