// The default crafts and the field names and limits of a pack's crafts.

// The default crafts: the stats a check rolls with and the stations it can be worked at (none
// listed: anywhere). A pack's `crafts` record with the same id replaces one; a new id adds a craft.
export const DEFAULT_CRAFTS = Object.freeze([
    Object.freeze({ craft: 'smithing', title: 'Smithing', stats: Object.freeze(['STR', 'DEX']), stations: Object.freeze(['forge']) }),
    Object.freeze({ craft: 'alchemy', title: 'Alchemy', stats: Object.freeze(['INT']), stations: Object.freeze(['alchemy-table']) }),
    Object.freeze({ craft: 'leather', title: 'Leatherwork', stats: Object.freeze(['DEX']), stations: Object.freeze(['workbench', 'campfire', 'inn']) }),
    Object.freeze({ craft: 'cooking', title: 'Cooking', stats: Object.freeze(['VIT']), stations: Object.freeze(['campfire', 'inn']) }),
    Object.freeze({ craft: 'enchanting', title: 'Enchanting', stats: Object.freeze(['INT', 'LUK']), stations: Object.freeze(['workbench', 'alchemy-table']) }),
]);
// A pack's craft: `{ id, title, stats: ['INT', 'DEX'], stations?: ['alchemy-table'], note? }`.
export const CRAFT_FIELDS = Object.freeze(['id', 'title', 'stats', 'stations', 'note']);
export const CRAFTS_LIMITS = Object.freeze({ records: 12, title: 30, stats: 3, stations: 8, note: 200 });
