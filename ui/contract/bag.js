// Defines the view-model shape for the Bag tab (items, purse, load, pace, assets, loot to pick up).

import { SHAPE_TYPES as T } from './shapes.js';
import { LOOT_OFFER_SHAPE } from './loot.js';

const ITEM = {
  stack: T.STRING,
  name: T.STRING,
  kind: { $enum: ['gear', 'use', 'goods', 'material', 'quest'] },
  glyph: T.STRING,
  rarity: { $enum: ['common', 'uncommon', 'rare', 'epic'] },
  qty: T.NUMBER,
  wornBy: { $nullable: T.STRING },
  isNew: T.BOOLEAN,
  wear: { $nullable: { $enum: ['good', 'torn'] } },
  weight: T.NUMBER,
  worth: T.STRING,
  soak: T.NUMBER,
  desc: T.STRING,
  from: T.STRING,
  // The reader's note, a hand-made piece's flag and its base slot: only what the Edit form needs.
  note: { $optional: T.STRING },
  hand: { $optional: T.BOOLEAN },
  slot: { $optional: { $nullable: T.STRING } },
  // The reader may change a gear piece's slot (the story's and a pack's too; not a cast member's): the Edit form's Slot.
  slotEdit: { $optional: T.BOOLEAN },
  // The most soak the piece's slot lets it give (body and off-hand 2, head 1, the rest 0): the Edit form's Soak field.
  soakMax: { $optional: T.NUMBER },
  // What the piece adds to stats, as gear.view words it ("STR +1 · DEX +1"); '' for none.
  bonus: { $optional: T.STRING },
  // The grouped piece count (inventory.counts) the Edit form's Count starts from; null when the query gave none.
  // The item's own rarity word (the tile class folds legendary into epic); the Edit form's Rarity starts from it.
  realRarity: { $optional: { $nullable: T.STRING } },
  count: { $optional: { $nullable: T.NUMBER } },
  // A gear piece whose points the reader may move (gear.view's repoint): the total that stays and where it sits now ({ DEX: 1, AGI: 1 }); a cast member's piece is `bound`.
  repoint: { $optional: { budget: T.NUMBER, stats: T.ANY, labels: { $optional: T.ANY } } },
  bound: { $optional: T.BOOLEAN },
  // What the item adds to carrying (gear on): the Edit form's Carries, read-only with the engine's reason `carryWhy` ('' when the reader may set it).
  carry: { $optional: T.NUMBER },
  carryWhy: { $optional: T.STRING },
  // It can be carried as a bag (Carry as bag…), and it is someone's bag now.
  bagLike: { $optional: T.BOOLEAN },
  isBag: { $optional: T.BOOLEAN },
  // Whoever holds it left the party (their name): Take back.
  gone: { $optional: T.STRING },
};

const ASSET = {
  id: T.STRING,
  name: T.STRING,
  glyph: T.STRING,
  kindLabel: T.STRING,
  riders: [T.STRING],
  seats: { $nullable: T.NUMBER },
  where: T.STRING,
  withParty: T.BOOLEAN,
  condition: { $nullable: T.STRING },
  note: T.STRING,
  meta: [T.STRING],
  tag: T.STRING,
  // A transport row's Edit form: how many, km a day, and the reader's own carry (null: the kind's usual).
  count: { $optional: T.NUMBER },
  pace: { $optional: T.NUMBER },
  carry: { $optional: { $nullable: T.NUMBER } },
};

export const BAG_SHAPE = {
  rpg: T.BOOLEAN,
  // Gear in fights is on, and the starting kit is open (the + Add form's Rarity and Stats).
  gear: { $optional: { on: T.BOOLEAN, kit: T.BOOLEAN, labels: { $optional: T.ANY } } },
  filters: [{ key: { $enum: ['all', 'worn', 'gear', 'use', 'goods', 'material', 'quest'] }, count: T.NUMBER }],
  items: [ITEM],
  purse: {
    coins: { $nullable: { gold: T.NUMBER, silver: T.NUMBER, copper: T.NUMBER } },
    words: T.STRING,
    thisTurn: { $optional: [{ line: T.STRING, delta: T.STRING, up: T.BOOLEAN, earlier: T.BOOLEAN }] },
    rates: { $optional: { $nullable: { place: T.STRING, rows: [{ name: T.STRING, price: T.STRING }], note: T.STRING } } },
  },
  load: {
    $nullable: {
      value: T.NUMBER,
      limit: T.NUMBER,
      level: { $enum: ['light', 'heavy', 'over'] },
      breakdown: [{ label: T.STRING, value: T.NUMBER, text: T.STRING, dim: T.BOOLEAN }],
      // The members who hold things or a bag of their own: each one's load against their own limit. Someone who left and still holds things has `left` and
      // no limit (0); `unnamed` when no name is known for them.
      people: { $optional: [{ id: T.STRING, name: T.STRING, value: T.NUMBER, limit: T.NUMBER, level: { $enum: ['light', 'heavy', 'over'] }, left: { $optional: T.BOOLEAN }, unnamed: { $optional: T.BOOLEAN } }] },
      // Encumbered is off: the narrator is told nothing, so no note says it is.
      untold: { $optional: T.BOOLEAN },
    },
  },
  pace: { kmDay: T.NUMBER, by: T.STRING, slowed: T.BOOLEAN, why: T.STRING, alt: T.STRING },
  // `canAdd`: the mounts switch is on (Transport's + Add).
  assets: { transport: [ASSET], property: [ASSET], canAdd: { $optional: T.BOOLEAN } },
  // Every reply's loot not taken yet (the To pick up card); left out when none is laid out.
  loot: { $optional: [LOOT_OFFER_SHAPE] },
};
