// Deep copy and frozen sharing of pack records, used by every lookup over the packs.

import { deepFreeze } from '../../../../../../core/ops/freeze.js';

export const copy = value => JSON.parse(JSON.stringify(value));

// What contentOf hands out: the pack's own records, frozen all the way down (once; a frozen value is not walked again), not copies of
// them. Nothing can change a pack through one, and a reader that wants to edit makes its own copy.
export const shared = list => Object.freeze(list.map(deepFreeze));
