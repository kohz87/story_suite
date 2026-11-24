// Turns the recorded inventory, gear, wallet and mount query answers into the Bag view-model (BAG_SHAPE), leaving gaps null.

import { money } from './money.js';
import { slotWordOf } from '../../modules/inventory/gear.js';
import { purseLines } from './purse-lines.js';
import { labelsOf, relabel } from './stat-labels.js';

const KIND_OF = { equipment: 'gear', consumable: 'use', goods: 'goods', material: 'material', quest: 'quest' };
const GLYPH_OF_SLOT = { weapon: 'weapon', body: 'armor', 'off-hand': 'offhand', head: 'head', cloak: 'cloak', feet: 'feet', 'accessory-1': 'accessory', 'accessory-2': 'accessory', accessory: 'accessory' };
const RARITY = { common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'epic', legendary: 'epic' };
const FILTER_KEYS = ['all', 'worn', 'gear', 'use', 'goods', 'material', 'quest'];
const LOAD_LEVEL = { normal: 'light', heavy: 'heavy', over: 'over' };

// gear.view's carry.parts → the load chips ({ label, value, text, dim }); [] when it gave none.
const loadParts = parts => (Array.isArray(parts) ? parts.filter(isRecord).map(p => ({ label: String(p.label), value: Number.isFinite(p.value) ? p.value : 0, text: String(p.text ?? ''), dim: p.dim === true })) : []);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// inventory.items row (queries.js:42-63) + gear.view `rows[stack]` (views.js:93-110) → one contract item; desc and isNew are gaps; weight, soak and soakMax come from gear.view's row.
const whole = value => (Number.isSafeInteger(value) ? value : null);

function itemOf(row, ctx) {
  const kind = KIND_OF[row.kind];
  const info = ctx.rows?.[row.stack];
  const word = info?.word;
  const worn = row.equipped !== null && row.equipped !== undefined;
  const wearer = row.owner === 'party' ? ctx.pcId : row.owner;
  // (a worn piece shows the place it is worn at, an unworn one the slot its own def names: the Party slot sheet matches on it)
  const glyphSlot = GLYPH_OF_SLOT[row.equipped] ?? (kind === 'gear' ? GLYPH_OF_SLOT[slotWordOf(row.slot)] ?? 'gear' : kind);
  return {
    stack: String(row.stack), name: String(row.name), kind, glyph: glyphSlot, rarity: RARITY[row.rarity] ?? 'common', realRarity: typeof row.rarity === 'string' ? row.rarity : null,
    qty: Number.isSafeInteger(row.qty) ? row.qty : 1, count: Number.isSafeInteger(ctx.counts?.[row.stack]) ? ctx.counts[row.stack] : null, wornBy: worn ? wearer ?? null : null, isNew: null,
    wear: kind === 'gear' && word ? (word === 'torn' || word === 'broken' ? 'torn' : 'good') : null,
    weight: whole(info?.weight), bonus: typeof info?.bonus === 'string' ? relabel(info.bonus, ctx.labels) : '', worth: money(row.value, ctx.currency), soak: whole(info?.soakOwn), ...(whole(info?.soakMax) !== null ? { soakMax: info.soakMax } : {}), desc: null, from: originOf(row.from),
    note: typeof row.note === 'string' ? row.note : '', hand: row.hand === true, slot: typeof row.slot === 'string' ? row.slot : null,
    ...(kind === 'gear' ? gearOf(info, ctx.labels) : {}),
    ...carryOf(info, ctx.packs?.[row.stack], kind === 'gear' && Boolean(slotWordOf(row.slot))),
  };
}

// What the item adds to carrying and whether the reader may set it (gear.view's row: `carryWhy` is the engine's reason they cannot, '' when they can; a pack's
// own carry shows read-only), and whether it can be carried as a bag (gear.view's carriers.packs: `bag` while it is someone's bag). Nothing while gear is off,
// nor for a piece worn in a slot of its own (`slotted`: a sword is never a bag) unless it already adds something.
function carryOf(info, pack, slotted) {
  if (!isRecord(info) || !Number.isSafeInteger(info.carry)) return {};
  const carry = Number.isSafeInteger(pack?.carry) && pack.carry > info.carry ? pack.carry : info.carry;
  if (slotted && carry === 0) return {};
  return { carry, carryWhy: typeof info.carryWhy === 'string' ? info.carryWhy : '', ...(isRecord(pack) ? { bagLike: true, isBag: pack.bag === true } : {}) };
}

// A gear piece's points for the Stats row and its Change (gear.view's `repoint`: the total that stays and where it sits now), and whether it is a cast member's.
const statsRecord = raw => Object.fromEntries(Object.entries(isRecord(raw) ? raw : {}).filter(([, n]) => Number.isSafeInteger(n) && n > 0));
const gearOf = (info, labels) => ({
  ...(isRecord(info?.repoint) && Number.isSafeInteger(info.repoint.budget) ? { repoint: { budget: info.repoint.budget, stats: statsRecord(info.repoint.stats), ...(labels ? { labels } : {}) } } : {}),
  ...(isRecord(info?.bound) ? { bound: true } : {}),
});

// mounts.list row (domains/mounts.js:83-91) → a transport asset; `carried` is gear.view's carriers.mounts row of that name (withParty, riders from its `where`, what it adds). Seats are not recorded: null.
const assetOf = (row, carried) => ({
  id: slug(row.name), name: row.name, glyph: /cart|wagon|carriage|coach|barrow|sledge/i.test(row.kind) ? 'cart' : /boat|barge/i.test(row.kind) ? 'boat' : 'mount',
  kindLabel: row.kind, riders: (Array.isArray(carried?.riders) ? carried.riders : []).map(String), seats: null, where: row.where,
  withParty: typeof carried?.withParty === 'boolean' ? carried.withParty : row.where.trim() === '' ? true : null,
  condition: row.condition || null, note: '', meta: [row.kind, `${row.pace} km/day`, ...(Number.isSafeInteger(carried?.carry) && carried.carry > 0 ? [`+${carried.carry} load`] : [])].filter(Boolean), tag: '',
  // (the Edit form's starting values: the row as mounts.list gives it; `carry` the reader's own, null for the kind's usual)
  count: Number.isSafeInteger(row.count) ? row.count : 1, pace: Number.isSafeInteger(row.pace) ? row.pace : 0, carry: Number.isSafeInteger(row.carry) ? row.carry : null,
});

// Where a stack came from, for the item sheet: a receipt id (`rc_…`, what the stack records) means nothing to a reader, so only a worded origin shows.
const originOf = from => (typeof from === 'string' && !/^rc_/u.test(from) ? from : '');

/**
 * Bag view-model from { rpg, items: inventory.items, counts: inventory.counts (pieces per def+owner for unstacked items), gear: gear.view, wallet: inventory.wallet, currency: inventory.currency,
 * mounts: mounts.list, pace: mounts.pace, changes: reply.changes (the head reply's lines; the purse's coin lines are the turn's), carriers: gear.view's `carriers` (mounts with the party, what each adds; `packs`: the items that can be carried as a bag), pcId, labels: gear.statLabels (the names the gear's stats show under) }; null when inventory.items does not answer.
 */
export function selectBag({ rpg = false, items, counts, gear, wallet, currency, mounts, pace, carriers, changes, pcId = null, labels = null } = {}) {
  if (!Array.isArray(items)) return null;
  const packs = Object.fromEntries((Array.isArray(carriers?.packs) ? carriers.packs : []).filter(isRecord).map(pack => [pack.stack, pack]));
  const shown = labelsOf(labels);
  const ctx = { labels: shown, rows: gear?.rows, currency, pcId, counts: isRecord(counts) ? counts : {}, packs };
  const list = items.filter(row => isRecord(row) && KIND_OF[row.kind]).map(row => itemOf(row, ctx));
  // (the grid lists a worn piece under Worn only, so "In bag" and the kind chips count the unworn ones)
  const loose = list.filter(item => item.wornBy === null);
  const countOf = { all: loose.length, worn: list.length - loose.length };
  const carry = gear?.carry;
  return {
    rpg: rpg === true,
    // Gear in fights (gear.view answers only while it is on) and the starting kit (no message from the reader yet: Rarity and Stats go with + Add).
    gear: { on: gear?.on === true, kit: gear?.kit?.open === true, ...(shown ? { labels: shown } : {}) },
    filters: FILTER_KEYS.map(key => ({ key, count: countOf[key] ?? loose.filter(item => item.kind === key).length })),
    items: list,
    // The wallet keeps one amount under `coin` (inventory/state.js WALLET_KEY): the denominations are in `words`, so `coins` stays null; `thisTurn` is the head reply's coin line; no rates yet.
    purse: { coins: null, words: money(wallet?.coin ?? 0, currency), thisTurn: purseLines(changes, currency), rates: null },
    load: isRecord(carry) && carry.capacity > 0
      ? { value: carry.load, limit: carry.capacity, level: LOAD_LEVEL[carry.level] ?? 'light', breakdown: loadParts(carry.parts) } : null,
    pace: isRecord(pace) ? { kmDay: pace.pace, by: String(pace.slowest ?? ''), slowed: pace.short > 0, why: '', alt: '' } : null,
    // (`canAdd`: the mounts switch is on, so mounts.list answers and Transport offers + Add even with no mount yet)
    assets: { transport: (Array.isArray(mounts) ? mounts.filter(isRecord) : []).map(row => assetOf(row, carriers?.mounts?.find?.(m => m?.name === row.name))), property: [], canAdd: Array.isArray(mounts) },
  };
}
