// Turns the recorded inventory, gear, wallet and mount query answers into the Bag view-model (BAG_SHAPE), leaving gaps null.

const KIND_OF = { equipment: 'gear', consumable: 'use', goods: 'goods', material: 'material', quest: 'quest' };
const GLYPH_OF_SLOT = { weapon: 'weapon', body: 'armor', 'off-hand': 'offhand', head: 'head', cloak: 'cloak', feet: 'feet', 'accessory-1': 'accessory', 'accessory-2': 'accessory' };
const RARITY = { common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'epic', legendary: 'epic' };
const FILTER_KEYS = ['all', 'worn', 'gear', 'use', 'goods', 'material', 'quest'];
const LOAD_LEVEL = { normal: 'light', heavy: 'heavy', over: 'over' };

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "5 marks": the chat's one currency (inventory.currency, answers.js:32), count-aware.
function money(amount, currency) {
  if (!Number.isFinite(amount)) return '';
  const name = currency?.name || 'coin';
  return `${amount} ${amount === 1 ? name : currency?.plural || `${name}s`}`;
}

// inventory.items row (queries.js:42-63) + gear.view `rows[stack]` (views.js:93-110) → one contract item; weight, desc, isNew and soak are gaps.
function itemOf(row, ctx) {
  const kind = KIND_OF[row.kind];
  const word = ctx.rows?.[row.stack]?.word;
  const worn = row.equipped !== null && row.equipped !== undefined;
  const wearer = row.owner === 'party' ? ctx.pcId : row.owner;
  const glyphSlot = GLYPH_OF_SLOT[row.equipped] ?? (kind === 'gear' ? 'gear' : kind);
  return {
    stack: String(row.stack), name: String(row.name), kind, glyph: glyphSlot, rarity: RARITY[row.rarity] ?? 'common', realRarity: typeof row.rarity === 'string' ? row.rarity : null,
    qty: Number.isSafeInteger(row.qty) ? row.qty : 1, count: Number.isSafeInteger(ctx.counts?.[row.stack]) ? ctx.counts[row.stack] : null, wornBy: worn ? wearer ?? null : null, isNew: null,
    wear: kind === 'gear' && word ? (word === 'torn' || word === 'broken' ? 'torn' : 'good') : null,
    weight: null, worth: money(row.value, ctx.currency), soak: null, desc: null, from: typeof row.from === 'string' ? row.from : '',
    note: typeof row.note === 'string' ? row.note : '', hand: row.hand === true, slot: typeof row.slot === 'string' ? row.slot : null,
  };
}

// mounts.list row (domains/mounts.js:83-91) → a transport asset; riders, seats and the Mount-slot link are gaps. "With the party" is only known for an empty `where`.
const assetOf = row => ({
  id: slug(row.name), name: row.name, glyph: /cart|wagon|carriage|coach|barrow|sledge/i.test(row.kind) ? 'cart' : /boat|barge/i.test(row.kind) ? 'boat' : 'mount',
  kindLabel: row.kind, riders: [], seats: null, where: row.where, withParty: row.where.trim() === '' ? true : null,
  condition: row.condition || null, note: '', meta: [row.kind, `${row.pace} km/day`].filter(Boolean), tag: '',
});

/**
 * Bag view-model from { rpg, items: inventory.items, counts: inventory.counts (pieces per def+owner for unstacked items), gear: gear.view, wallet: inventory.wallet, currency: inventory.currency,
 * mounts: mounts.list, pace: mounts.pace, pcId }; null when inventory.items does not answer.
 */
export function selectBag({ rpg = false, items, counts, gear, wallet, currency, mounts, pace, pcId = null } = {}) {
  if (!Array.isArray(items)) return null;
  const ctx = { rows: gear?.rows, currency, pcId, counts: isRecord(counts) ? counts : {} };
  const list = items.filter(row => isRecord(row) && KIND_OF[row.kind]).map(row => itemOf(row, ctx));
  const countOf = { all: list.length, worn: list.filter(item => item.wornBy !== null).length };
  const carry = gear?.carry;
  return {
    rpg: rpg === true,
    filters: FILTER_KEYS.map(key => ({ key, count: countOf[key] ?? list.filter(item => item.kind === key).length })),
    items: list,
    // The wallet keeps one amount under `coin` (inventory/state.js WALLET_KEY): no gold/silver/copper split, no turn log, no rates yet.
    purse: { coins: null, words: money(wallet?.coin ?? 0, currency), thisTurn: [], rates: null },
    load: isRecord(carry) && carry.capacity > 0
      ? { value: carry.load, limit: carry.capacity, level: LOAD_LEVEL[carry.level] ?? 'light', breakdown: [] } : null,
    pace: isRecord(pace) ? { kmDay: pace.pace, by: String(pace.slowest ?? ''), slowed: pace.short > 0, why: '', alt: '' } : null,
    assets: { transport: (Array.isArray(mounts) ? mounts.filter(isRecord) : []).map(assetOf), property: [] },
  };
}
