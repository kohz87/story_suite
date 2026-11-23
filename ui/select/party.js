// Turns the recorded party and gear query answers into the Party view-model (PARTY_SHAPE), leaving gaps null.

import { PARTY_ACTIVE, PARTY_LISTED } from './party-max.js';

// gear.view place keys (modules/inventory/gear/stats.js) → the contract's slot keys; mount and bag are gear.view's `ride` and `bagSlot` (views-parts/slot-carriers.js).
const SLOT_OF_PLACE = { head: 'head', body: 'armor', cloak: 'cloak', feet: 'feet', weapon: 'weapon', 'off-hand': 'offhand', 'accessory-1': 'accessory1', 'accessory-2': 'accessory2' };
const SLOT_KEYS = ['head', 'armor', 'cloak', 'feet', 'mount', 'weapon', 'offhand', 'accessory1', 'accessory2', 'bag'];
const RARITY = { common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'epic', legendary: 'epic' };

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// gear.view `slots` ({ [place]: { stack, name, rarity, bonus, word, broken } | null }, modules/inventory/gear/views-parts/view.js) → the ten contract slots
// (`bonus`: the piece's stat bonus text, "+2 STR"; the slot sheet's "Gives" line for a worn weapon or offhand).
function slotsOf(gearView) {
  const worn = {};
  const places = isRecord(gearView?.slots) ? gearView.slots : {};
  for (const [place, piece] of Object.entries(places)) {
    if (!SLOT_OF_PLACE[place] || !isRecord(piece)) continue;
    // soak per item is a gap (§2.3): null until the core answers it.
    worn[SLOT_OF_PLACE[place]] = {
      stack: String(piece.stack), name: String(piece.name), rarity: RARITY[piece.rarity] ?? 'common',
      soak: null, torn: piece.broken === true || piece.word === 'torn', bonus: typeof piece.bonus === 'string' ? piece.bonus : '',
    };
  }
  // The Mount slot: the mount the member rides (its `stack` is the Bag Transport asset's id, the name's slug: a mount is no item); the Bag slot: the item carried as their bag.
  const ride = gearView?.ride, bag = gearView?.bagSlot;
  if (isRecord(ride)) worn.mount = { stack: slug(ride.name), name: String(ride.name), rarity: 'common', soak: 0, torn: false, kind: String(ride.kind ?? ''), pace: whole(ride.pace), carry: whole(ride.carry) };
  if (isRecord(bag)) worn.bag = { stack: String(bag.stack), name: String(bag.name), rarity: 'common', soak: 0, torn: false, carry: whole(bag.carry) };
  return SLOT_KEYS.map(key => ({ key, item: worn[key] ?? null }));
}
const whole = value => (Number.isSafeInteger(value) ? value : 0);
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// gear.view's `carriers` (the same for every member) → what the Mount and Bag pickers list; null when gear.view does not answer.
function carriersOf(views) {
  const view = Object.values(isRecord(views) ? views : {}).find(entry => isRecord(entry?.carriers));
  if (!view) return null;
  const rides = Array.isArray(view.carriers.rides) ? view.carriers.rides.filter(isRecord) : [];
  const packs = Array.isArray(view.carriers.packs) ? view.carriers.packs.filter(isRecord) : [];
  return {
    mounts: rides.map(row => ({ name: String(row.name), kind: String(row.kind ?? ''), pace: whole(row.pace), count: whole(row.count) || 1, carry: whole(row.carry),
      riders: (Array.isArray(row.riders) ? row.riders : []).map(String), withParty: row.withParty !== false, where: String(row.where ?? '') })),
    packs: packs.map(row => ({ stack: String(row.stack), name: String(row.name), carry: whole(row.carry), owner: String(row.owner), by: String(row.by ?? ''), bag: row.bag === true, bound: String(row.bound ?? '') })),
  };
}

// inventory.gear statBonus ({ STR: 1, VIT: 2 }) → only the stats a worn piece raises ({} for none).
const bonusOf = raw => Object.fromEntries(Object.entries(isRecord(raw) ? raw : {}).filter(([, n]) => Number.isSafeInteger(n) && n > 0));

// A sheet row's own command names (`spend`, `skillEdit`): short strings only, else absent (the Party tab then sends the RPG's).
function commandsOf(raw) {
  const out = {};
  for (const key of ['spend', 'skillEdit']) if (isRecord(raw) && typeof raw[key] === 'string' && raw[key] && raw[key].length <= 80) out[key] = raw[key];
  return Object.keys(out).length ? out : null;
}

// One member: what party.actors, party.levels and gear.view give; every sheet field is a gap unless `sheet` (the member's `rpg.sheet` row) carries it.
function memberOf(actor, level, gearView, sheet, portrait = null) {
  const known = Number.isSafeInteger(level) ? level : null;
  const own = isRecord(sheet) ? sheet : {};
  const commands = commandsOf(own.commands);
  return {
    id: String(actor.id), name: String(actor.name), portrait: own.portrait ?? portrait ?? null,
    line: own.line ?? (known === null ? '' : `Lv ${known}`),
    level: known ?? (Number.isSafeInteger(own.level) ? own.level : null), xpPct: own.xpPct ?? null, points: own.points ?? null, away: own.away ?? null, soakPct: own.soakPct ?? null,
    bars: Array.isArray(own.bars) ? own.bars : [], effects: Array.isArray(own.effects) ? own.effects : [],
    stats: isRecord(own.stats) ? own.stats : null, bonus: bonusOf(gearView?.statBonus), slots: slotsOf(gearView), skills: Array.isArray(own.skills) ? own.skills : [],
    ...(commands ? { commands } : {}),
  };
}

/**
 * Party view-model from { actors: party.actors, pc: party.pc, levels: party.levels, gear: { [id]: gear.view }, sheet?: rpg.sheet rows [{ id, ... }], portraits?: { [id]: url } (gather.js partyPortraits) };
 * null while the RPG is off (party.actors answers null).
 */
export function selectParty({ actors, pc, levels, gear, sheet, portraits } = {}) {
  if (!Array.isArray(actors) || actors.length === 0) return null;
  const levelOf = new Map((Array.isArray(levels) ? levels : []).map(row => [row?.id, row?.level]));
  const sheets = new Map((Array.isArray(sheet) ? sheet : []).filter(isRecord).map(row => [row.id, row]));
  const members = actors.filter(isRecord).slice(0, PARTY_LISTED)
    .map(actor => memberOf(actor, levelOf.get(actor.id), gear?.[actor.id], sheets.get(actor.id), isRecord(portraits) && typeof portraits[actor.id] === 'string' ? portraits[actor.id] : null));
  // A plug-in sheet names its own Create character screen on its answer (the first row that does).
  const screen = (Array.isArray(sheet) ? sheet : []).find(row => isRecord(row) && typeof row.newCharacterScreen === 'string' && row.newCharacterScreen && row.newCharacterScreen.length <= 80)?.newCharacterScreen;
  return {
    pcId: isRecord(pc) && typeof pc.id === 'string' ? pc.id : null,
    // (`max` is the active limit, 4: at 4 active a new `+ party` asks who steps out, so Invite is not offered; an older chat may list more)
    max: PARTY_ACTIVE, canInvite: members.length < PARTY_ACTIVE, members,
    // (the Mount and Bag pickers' lists)
    ...(carriersOf(gear) ? { carriers: carriersOf(gear) } : {}),
    ...(screen ? { newCharacterScreen: screen } : {}),
  };
}
