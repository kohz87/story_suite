// Turns the recorded party and gear query answers into the Party view-model (PARTY_SHAPE), leaving gaps null.

// gear.view place keys (packages/story-block/src/v2/domains/gear/stats.js:10) → the contract's slot keys; mount and bag have no source yet.
const SLOT_OF_PLACE = { head: 'head', body: 'armor', cloak: 'cloak', feet: 'feet', weapon: 'weapon', 'off-hand': 'offhand', 'accessory-1': 'accessory1', 'accessory-2': 'accessory2' };
const SLOT_KEYS = ['head', 'armor', 'cloak', 'feet', 'mount', 'weapon', 'offhand', 'accessory1', 'accessory2', 'bag'];
const MAX_PARTY = 4;
const RARITY = { common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'epic', legendary: 'epic' };

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// gear.view `slots` ({ [place]: { stack, name, rarity, word, broken } | null }, domains/gear/views.js:94-98) → the ten contract slots.
function slotsOf(gearView) {
  const worn = {};
  const places = isRecord(gearView?.slots) ? gearView.slots : {};
  for (const [place, piece] of Object.entries(places)) {
    if (!SLOT_OF_PLACE[place] || !isRecord(piece)) continue;
    // soak per item is a gap (§2.3): null until the core answers it.
    worn[SLOT_OF_PLACE[place]] = {
      stack: String(piece.stack), name: String(piece.name), rarity: RARITY[piece.rarity] ?? 'common',
      soak: null, torn: piece.broken === true || piece.word === 'torn',
    };
  }
  return SLOT_KEYS.map(key => ({ key, item: worn[key] ?? null }));
}

// One member: what party.actors, party.levels and gear.view give; every sheet field is a gap unless `sheet` (the member's `rpg.sheet` row) carries it.
function memberOf(actor, level, gearView, sheet) {
  const known = Number.isSafeInteger(level) ? level : null;
  const own = isRecord(sheet) ? sheet : {};
  return {
    id: String(actor.id), name: String(actor.name), portrait: own.portrait ?? null,
    line: own.line ?? (known === null ? '' : `Lv ${known}`),
    level: known ?? (Number.isSafeInteger(own.level) ? own.level : null), xpPct: own.xpPct ?? null, points: own.points ?? null, away: own.away ?? null, soakPct: own.soakPct ?? null,
    bars: Array.isArray(own.bars) ? own.bars : [], effects: Array.isArray(own.effects) ? own.effects : [],
    stats: isRecord(own.stats) ? own.stats : null, slots: slotsOf(gearView), skills: Array.isArray(own.skills) ? own.skills : [],
  };
}

/**
 * Party view-model from { actors: party.actors, pc: party.pc, levels: party.levels, gear: { [id]: gear.view }, sheet?: rpg.sheet rows [{ id, ... }] };
 * null while the RPG is off (party.actors answers null).
 */
export function selectParty({ actors, pc, levels, gear, sheet } = {}) {
  if (!Array.isArray(actors) || actors.length === 0) return null;
  const levelOf = new Map((Array.isArray(levels) ? levels : []).map(row => [row?.id, row?.level]));
  const sheets = new Map((Array.isArray(sheet) ? sheet : []).filter(isRecord).map(row => [row.id, row]));
  const members = actors.filter(isRecord).slice(0, MAX_PARTY)
    .map(actor => memberOf(actor, levelOf.get(actor.id), gear?.[actor.id], sheets.get(actor.id)));
  return {
    pcId: isRecord(pc) && typeof pc.id === 'string' ? pc.id : null,
    max: MAX_PARTY, canInvite: members.length < MAX_PARTY, members,
  };
}
