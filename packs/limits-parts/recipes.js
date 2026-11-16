// Recipe crafting fields and limits, the stat-sum pattern and the named stations.

// Crafting (MODULES §F102). A recipe may say which craft it is, how hard (`dc`), where it is made
// (`station`), which stats it rolls with (`stat`, overriding the craft's), whether a character knows
// it from the start (`known`) and who teaches it. A crafting module may read them; code sets every
// chance. Fields a recipe had before (fee, minutes, any other plain data) are kept as they were.
export const RECIPE_CRAFT_FIELDS = Object.freeze(['craft', 'dc', 'station', 'stat', 'known', 'teaches']);
export const RECIPE_LIMITS = Object.freeze({ dcMin: 5, dcMax: 40, teaches: 120, stats: 3 });
// Two or three stats joined by `+`, or one: `STR+DEX`, `INT`.
export const STAT_SUM = /^[A-Z]{2,12}(?:\+[A-Z]{2,12}){0,2}$/;
// The stations Story Suite names; a pack may name any other slug (`salt-yard`).
export const STATIONS = Object.freeze(['forge', 'alchemy-table', 'campfire', 'inn', 'workbench']);
