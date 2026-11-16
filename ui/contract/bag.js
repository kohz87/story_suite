// Defines the view-model shape for the Bag tab (items, purse, load, pace, assets).

import { SHAPE_TYPES as T } from './shapes.js';

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
  // The grouped piece count (inventory.counts) the Edit form's Count starts from; null when the query gave none.
  // The item's own rarity word (the tile class folds legendary into epic); the Edit form's Rarity starts from it.
  realRarity: { $optional: { $nullable: T.STRING } },
  count: { $optional: { $nullable: T.NUMBER } },
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
};

export const BAG_SHAPE = {
  rpg: T.BOOLEAN,
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
    },
  },
  pace: { kmDay: T.NUMBER, by: T.STRING, slowed: T.BOOLEAN, why: T.STRING, alt: T.STRING },
  assets: { transport: [ASSET], property: [ASSET] },
};
