// Tells whether a def is one the reader made by hand, with no story-given stack of it.

import { isPlainObject } from '../../common.js';

/** Is this def one the reader made by hand (`hand: true`), with no story-given stack of it? Only then may the reader's Edit change its kind, slot, rarity or bonus. */
export const handDef = (inventory, def) => def?.hand === true
    && !Object.values(isPlainObject(inventory?.stacks) ? inventory.stacks : {}).some(stack => stack?.def === def.id && stack.story === true);
