// Builds the shared Party fixture: Astra, Brann, Rika and Torka with sheets, gear slots and skills.

import { BAG } from './bag.js';

const SLOT_KEYS = ['head', 'armor', 'cloak', 'feet', 'mount', 'weapon', 'offhand', 'accessory1', 'accessory2', 'bag'];
const STAT_KEYS = ['STR', 'DEX', 'AGI', 'VIT', 'INT', 'WIS', 'CHA'];
const KIND_STAT = { attack: 'STR', area: 'STR', magic: 'INT', heal: 'WIS', stance: 'AGI' };
const MOUNTS = {
  'Dappled mare': { stack: 'dappled-mare', name: 'Dappled mare', rarity: 'uncommon', soak: 0, torn: false },
  'Grey pony': { stack: 'grey-pony', name: 'Grey pony', rarity: 'common', soak: 0, torn: false },
};
// id, name, level, line, current [hp, mp, sp] (null = full), xp, stats, points, away, worn items by slot, effects, skills
const CAST = [
  ['astra', 'Astra', 14, 'Lv 14 · Shadow Blade · Human', [12, null, 12], 62, [6, 12, 12, 10, 6, 6, 5], 1, null,
    ['', 'Travel leathers', 'Grey wool cloak', 'Riding boots', 'Dappled mare', 'Steel longsword', 'Oak round shield', '', 'Silver ring', 'Leather satchel'],
    [{ id: 'shadow-step', label: 'Shadow Step', note: 'stance on · evasion', tone: 'buff' }],
    [['atk', 'Iaijutsu', 'attack', 'DEX', 'stamina', 1, 'Adept', 3], ['area', 'Flash', 'area', 'STR', 'stamina', 2, 'Apprentice', 2],
      ['bolt', 'Shadow Bolt', 'magic', 'INT', 'mana', 1, 'Apprentice', 2], ['heal', 'Mend', 'heal', 'WIS', 'mana', 2, 'Novice', 1],
      ['stance', 'Shadow Step', 'stance', 'AGI', 'stamina', 1, 'Adept', 3]]],
  ['brann', 'Brann', 9, 'Lv 9 · Shield of the party · Half-orc', [null, null, 11], 15, [11, 7, 6, 12, 5, 6, 6], 0, null,
    ['Iron cap', 'Chain shirt', '', 'Hob boots', '', 'Iron axe', 'Tower shield', 'Red Cord oath-coin', '', ''],
    [{ id: 'shield-wall', label: 'Shield wall', note: 'stance on · soak 22%', tone: 'buff' }],
    [['area', 'Cleave', 'area', 'STR', 'stamina', 2, 'Apprentice', 2], ['atk', 'Heavy blow', 'attack', 'STR', 'stamina', 1, 'Novice', 1],
      ['stance', 'Shield wall', 'stance', 'VIT', 'stamina', 1, 'Novice', 1]]],
  ['rika', 'Rika', 11, 'Lv 11 · Scout · Elf', [null, null, null], 40, [6, 13, 12, 8, 5, 6, 5], 0,
    { where: 'At the Bluewatch stables with the horses', lastSeen: '8:00 am' },
    ['', 'Scout leathers', 'Green cloak', 'Soft boots', 'Grey pony', 'Short bow', '', '', '', 'Quiver bag'], [],
    [['atk', 'Aimed shot', 'attack', 'DEX', 'stamina', 1, 'Adept', 3], ['stance', 'Fade', 'stance', 'AGI', 'stamina', 1, 'Novice', 1]]],
  ['torka', 'Torka', 12, 'Lv 12 · Sellsword · Orc', [null, null, null], 72, [13, 8, 9, 11, 5, 5, 5], 0, null,
    ['', 'Brigandine', '', 'Hob boots', '', 'Greatsword', '', 'Lucky ring', '', ''], [],
    [['area', 'Whirlwind', 'area', 'STR', 'stamina', 2, 'Adept', 3], ['atk', 'Brute strike', 'attack', 'STR', 'stamina', 1, 'Apprentice', 2]]],
];

const itemFor = (name, owner) => {
  if (!name) return null;
  if (MOUNTS[name]) return { ...MOUNTS[name] };
  const stack = name === 'Hob boots' ? `hob-boots-${owner}` : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const it = BAG.items.find(x => x.stack === stack);
  return { stack, name, rarity: it.rarity, soak: it.soak, torn: it.wear === 'torn' };
};

// Combat Rules v1 pools, every term rounded down: stats are STR DEX AGI VIT INT WIS CHA.
const pools = (lv, s) => [
  5 + Math.floor(lv / 3) + Math.floor(s[3] / 2),
  8 + Math.floor(lv / 4) + Math.floor((s[4] + s[5]) / 4),
  8 + Math.floor(lv / 4) + Math.floor((s[0] + s[2]) / 4),
];

function makeMember([id, name, level, line, cur, xp, st, points, away, worn, effects, skills]) {
  const max = pools(level, st);
  const slots = SLOT_KEYS.map((key, i) => ({ key, item: itemFor(worn[i], id) }));
  const gearSoak = slots.reduce((t, s) => t + (s.item ? s.item.soak : 0), 0);
  return {
    id, name, portrait: id, line, level, xpPct: xp, points, away: away ? { ...away } : null,
    soakPct: Math.max(1, Math.min(50, st[3] + gearSoak)),
    bars: ['hp', 'mp', 'sp'].map((kind, i) => ({ kind, value: cur[i] == null ? max[i] : cur[i], max: max[i] })),
    effects: effects.map(e => ({ ...e })),
    stats: Object.fromEntries(STAT_KEYS.map((k, i) => [k, st[i]])),
    slots,
    skills: skills.map(([glyph, sn, kind, stat, resource, cost, rank, mastery]) => ({
      glyph, name: sn, kind, stat: stat || KIND_STAT[kind], resource, cost, rank, mastery,
    })),
  };
}

export function partyFixture({ members = 4 } = {}) {
  const list = CAST.slice(0, Math.max(1, Math.min(4, members))).map(makeMember);
  return { pcId: 'astra', max: 4, canInvite: list.length < 4, members: list };
}

export const PARTY = Object.freeze(partyFixture());
