// Turns the recorded inventory, gear, wallet and mount query answers into the Bag view-model (BAG_SHAPE), leaving gaps null.

const KIND_OF = { equipment: 'gear', consumable: 'use', goods: 'goods', material: 'material', quest: 'quest' };
const GLYPH_OF_SLOT = { weapon: 'weapon', body: 'armor', 'off-hand': 'offhand', head: 'head', cloak: 'cloak', feet: 'feet', 'accessory-1': 'accessory', 'accessory-2': 'accessory' };
const RARITY = { common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'epic', legendary: 'epic' };
const FILTER_KEYS = ['all', 'worn', 'gear', 'use', 'goods', 'material', 'quest'];
const LOAD_LEVEL = { normal: 'light', heavy: 'heavy', over: 'over' };

// gear.view's carry.parts → the load chips ({ label, value, text, dim }); [] when it gave none.
const loadParts = parts => (Array.isArray(parts) ? parts.filter(isRecord).map(p => ({ label: String(p.label), value: Number.isFinite(p.value) ? p.value : 0, text: String(p.text ?? ''), dim: p.dim === true })) : []);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "5 marks": the chat's one currency (inventory.currency, answers.js:32), count-aware. With denominations (`currency.coins`: [{ name, plural, value }]) and no `display: 'base'`: largest first, "3 silver 5 pennies".
function money(amount, currency) {
  if (!Number.isFinite(amount)) return '';
  const coins = Array.isArray(currency?.coins) ? currency.coins.filter(coin => isRecord(coin) && coin.value > 0) : [];
  const unit = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (coins.length) {
    const base = coins.find(coin => coin.value === 1) ?? coins[0];
    if (currency.display === 'base' || amount < 1) return unit(amount, base.name, base.plural || `${base.name}s`);
    const parts = [];
    let rest = Math.floor(amount);
    for (const coin of coins.filter((c, at) => coins.findIndex(o => o.value === c.value) === at).sort((a, b) => b.value - a.value)) {
      const n = Math.floor(rest / coin.value);
      if (n) parts.push(unit(n, coin.name, coin.plural || `${coin.name}s`));
      rest -= n * coin.value;
    }
    if (rest) parts.push(unit(rest, base.name, base.plural || `${base.name}s`));
    return parts.join(' ');
  }
  const name = currency?.name || 'coin';
  return unit(amount, name, currency?.plural || `${name}s`);
}

// inventory.items row (queries.js:42-63) + gear.view `rows[stack]` (views.js:93-110) → one contract item; desc and isNew are gaps; weight, soak and soakMax come from gear.view's row.
const whole = value => (Number.isSafeInteger(value) ? value : null);

function itemOf(row, ctx) {
  const kind = KIND_OF[row.kind];
  const info = ctx.rows?.[row.stack];
  const word = info?.word;
  const worn = row.equipped !== null && row.equipped !== undefined;
  const wearer = row.owner === 'party' ? ctx.pcId : row.owner;
  const glyphSlot = GLYPH_OF_SLOT[row.equipped] ?? (kind === 'gear' ? 'gear' : kind);
  return {
    stack: String(row.stack), name: String(row.name), kind, glyph: glyphSlot, rarity: RARITY[row.rarity] ?? 'common', realRarity: typeof row.rarity === 'string' ? row.rarity : null,
    qty: Number.isSafeInteger(row.qty) ? row.qty : 1, count: Number.isSafeInteger(ctx.counts?.[row.stack]) ? ctx.counts[row.stack] : null, wornBy: worn ? wearer ?? null : null, isNew: null,
    wear: kind === 'gear' && word ? (word === 'torn' || word === 'broken' ? 'torn' : 'good') : null,
    weight: whole(info?.weight), worth: money(row.value, ctx.currency), soak: whole(info?.soakOwn), ...(whole(info?.soakMax) !== null ? { soakMax: info.soakMax } : {}), desc: null, from: typeof row.from === 'string' ? row.from : '',
    note: typeof row.note === 'string' ? row.note : '', hand: row.hand === true, slot: typeof row.slot === 'string' ? row.slot : null,
  };
}

// mounts.list row (domains/mounts.js:83-91) → a transport asset; `carried` is gear.view's carriers.mounts row of that name (withParty, riders from its `where`, what it adds). Seats are not recorded: null.
const assetOf = (row, carried) => ({
  id: slug(row.name), name: row.name, glyph: /cart|wagon|carriage|coach|barrow|sledge/i.test(row.kind) ? 'cart' : /boat|barge/i.test(row.kind) ? 'boat' : 'mount',
  kindLabel: row.kind, riders: (Array.isArray(carried?.riders) ? carried.riders : []).map(String), seats: null, where: row.where,
  withParty: typeof carried?.withParty === 'boolean' ? carried.withParty : row.where.trim() === '' ? true : null,
  condition: row.condition || null, note: '', meta: [row.kind, `${row.pace} km/day`, ...(Number.isSafeInteger(carried?.carry) && carried.carry > 0 ? [`+${carried.carry} load`] : [])].filter(Boolean), tag: '',
});

/**
 * Bag view-model from { rpg, items: inventory.items, counts: inventory.counts (pieces per def+owner for unstacked items), gear: gear.view, wallet: inventory.wallet, currency: inventory.currency,
 * mounts: mounts.list, pace: mounts.pace, carriers: gear.view's `carriers` (mounts with the party, what each adds), pcId }; null when inventory.items does not answer.
 */
export function selectBag({ rpg = false, items, counts, gear, wallet, currency, mounts, pace, carriers, pcId = null } = {}) {
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
      ? { value: carry.load, limit: carry.capacity, level: LOAD_LEVEL[carry.level] ?? 'light', breakdown: loadParts(carry.parts) } : null,
    pace: isRecord(pace) ? { kmDay: pace.pace, by: String(pace.slowest ?? ''), slowed: pace.short > 0, why: '', alt: '' } : null,
    assets: { transport: (Array.isArray(mounts) ? mounts.filter(isRecord) : []).map(row => assetOf(row, carriers?.mounts?.find?.(m => m?.name === row.name))), property: [] },
  };
}
