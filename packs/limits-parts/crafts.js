// The default crafts.

// The default crafts: the stats a check rolls with and the stations it can be worked at (none
// listed: anywhere).
export const DEFAULT_CRAFTS = Object.freeze([
    Object.freeze({ craft: 'smithing', title: 'Smithing', stats: Object.freeze(['STR', 'DEX']), stations: Object.freeze(['forge']) }),
    Object.freeze({ craft: 'alchemy', title: 'Alchemy', stats: Object.freeze(['INT']), stations: Object.freeze(['alchemy-table']) }),
    Object.freeze({ craft: 'leather', title: 'Leatherwork', stats: Object.freeze(['DEX']), stations: Object.freeze(['workbench', 'campfire', 'inn']) }),
    Object.freeze({ craft: 'cooking', title: 'Cooking', stats: Object.freeze(['VIT']), stations: Object.freeze(['campfire', 'inn']) }),
    Object.freeze({ craft: 'enchanting', title: 'Enchanting', stats: Object.freeze(['INT', 'LUK']), stations: Object.freeze(['workbench', 'alchemy-table']) }),
]);
