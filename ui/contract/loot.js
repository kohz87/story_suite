// Defines the view-model shape of the loot a reply laid out: each offer's things as chips to pick (the reply's row and the Bag's To pick up).

import { SHAPE_TYPES as T } from './shapes.js';

/** One offer: its reply's sid, where it lies, whether it was taken, and its things in offer order (`at` is the index `inventory.lootTake` picks by). */
export const LOOT_OFFER_SHAPE = {
  sid: T.STRING,
  where: T.STRING,
  taken: T.BOOLEAN,
  items: [{ at: T.NUMBER, label: T.STRING }],
};
