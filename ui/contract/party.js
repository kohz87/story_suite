// Defines the view-model shape for the Party tab (members, sheets, gear slots, skills).

import { SHAPE_TYPES as T } from './shapes.js';

const SLOT_KEYS = ['head', 'armor', 'cloak', 'feet', 'mount', 'weapon', 'offhand', 'accessory1', 'accessory2', 'bag'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic'];
const RANKS = ['Novice', 'Apprentice', 'Adept', 'Expert', 'Master', 'Grandmaster', 'Legend'];

const STATS = {
  STR: T.NUMBER, DEX: T.NUMBER, AGI: T.NUMBER, VIT: T.NUMBER, INT: T.NUMBER, WIS: T.NUMBER, CHA: T.NUMBER,
};

const SLOT = {
  key: { $enum: SLOT_KEYS },
  item: {
    $nullable: {
      stack: T.STRING,
      name: T.STRING,
      rarity: { $enum: RARITIES },
      soak: T.NUMBER,
      torn: T.BOOLEAN,
      // What the worn piece adds to stats, as gear.view writes it ("+2 STR", '' for none): a weapon or offhand piece's slot sheet says "Gives" it.
      bonus: { $optional: T.STRING },
      // The Mount slot's mount (kind, km a day, what it carries) and the Bag slot's bag (the load it adds); a mount's stack is its Bag Transport asset id.
      kind: { $optional: T.STRING },
      pace: { $optional: T.NUMBER },
      carry: { $optional: T.NUMBER },
    },
  },
};

const SKILL = {
  glyph: T.STRING,
  name: T.STRING,
  kind: { $enum: ['attack', 'area', 'magic', 'heal', 'stance'] },
  stat: T.STRING,
  resource: { $enum: ['stamina', 'mana'] },
  cost: T.NUMBER,
  rank: { $enum: RANKS },
  mastery: T.NUMBER,
  // Optional ready-made sheet line; the selector leaves it out until there is a data source (owner question), so the line is built from kind, stat and cost.
  line: { $optional: { $nullable: T.STRING } },
  // A stance skill's stance (Defence, Speed or Focus): the kind line reads "Speed stance".
  stance: { $optional: T.STRING },
};

const MEMBER = {
  id: T.STRING,
  name: T.STRING,
  portrait: { $nullable: T.STRING },
  line: T.STRING,
  level: T.NUMBER,
  xpPct: T.NUMBER,
  points: T.NUMBER,
  away: { $nullable: { where: T.STRING, lastSeen: T.STRING, short: { $optional: T.STRING } } },
  soakPct: T.NUMBER,
  bars: [{ kind: { $enum: ['hp', 'mp', 'sp'] }, value: T.NUMBER, max: T.NUMBER }],
  effects: [{ id: T.STRING, label: T.STRING, note: T.STRING, tone: { $enum: ['buff', 'debuff'] } }],
  stats: STATS,
  // The stats worn gear adds ({ STR: 1 }, only those above 0); the stat tiles mark them.
  bonus: { $optional: T.ANY },
  slots: [SLOT],
  skills: [SKILL],
};

// What the Mount and Bag pickers list: every mount (riders from its `where`; one rider per counted mount) and every bag-like item (whose it is, whether it is their bag).
const CARRIERS = {
  mounts: [{ name: T.STRING, kind: T.STRING, pace: T.NUMBER, count: T.NUMBER, carry: T.NUMBER, riders: [T.STRING], withParty: T.BOOLEAN, where: T.STRING }],
  packs: [{ stack: T.STRING, name: T.STRING, carry: T.NUMBER, owner: T.STRING, by: T.STRING, bag: T.BOOLEAN, bound: T.STRING }],
};

export const PARTY_SHAPE = {
  pcId: T.STRING,
  max: T.NUMBER,
  canInvite: T.BOOLEAN,
  members: [MEMBER],
  carriers: { $optional: CARRIERS },
};
