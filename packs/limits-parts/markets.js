// Field names, limits and word pattern of a pack's market price factors.

// Markets (PACKS.md "Markets"): price factors a pack adds or changes, each record one of
// `{ type: 'town', buy?, sell?, stock?: [least, most], note? }` (a settlement type) or
// `{ tag: 'coastal', prices: { fish: 0.8, all: 1.05 }, note? }` (an environment tag: a factor per item
// category, `all` for every thing). Factors are multipliers (1 = as usual). A place gets its type and tags
// from its `market` and `tags` (places), or a lorebook entry's `market:` line.
export const MARKET_FIELDS = Object.freeze(['type', 'tag', 'buy', 'sell', 'stock', 'prices', 'note']);
export const MARKET_LIMITS = Object.freeze({ records: 60, factorMin: 0.25, factorMax: 4, stock: 20, categories: 20, tags: 8, note: 200 });
// A settlement type, an environment tag or an item category: a lowercase word or two joined by dashes.
export const MARKET_WORD = /^[a-z][a-z0-9]*(?:-[a-z0-9]+){0,3}$/;
