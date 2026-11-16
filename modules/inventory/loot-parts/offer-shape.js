// The shape check of the loot on offer and reading an offer's things in order.

import { isPlainObject } from '../../scene/domains/common.js';
import { nonBlank, MAX_NAME, isCount } from '../state.js';
import { LOOT_ITEMS } from './limits.js';

export function lootErrors(loot) {
    if (!isPlainObject(loot)) return ['The loot on offer is not a record.'];
    const errors = [];
    for (const [key, offer] of Object.entries(loot)) {
        if (!isPlainObject(offer)) {
            errors.push(`The loot of reply ${key} is not a record.`);
            continue;
        }
        if (offer.sid !== key) errors.push(`The loot of reply ${key} is filed under the wrong reply.`);
        if (typeof offer.where !== 'string' || typeof offer.claim !== 'string' || !Number.isSafeInteger(offer.n)) errors.push(`The loot of reply ${key} is missing where it lies, its claim or its order.`);
        const list = lootItems(offer);
        if (!list || !list.length || list.length > LOOT_ITEMS
            || list.some(item => !isPlainObject(item) || !nonBlank(item.name) || item.name.length > MAX_NAME || !isCount(item.qty, 1)
                || (item.coin !== undefined && !isCount(item.coin, 1)))) {
            errors.push(`The loot of reply ${key} needs 1 to ${LOOT_ITEMS} things, each with a name and a positive quantity.`);
        }
    }
    return errors;
}

// An offer's things in order, or null when they are not kept as they should be. They are a record keyed
// "0", "1", … (not a list): a later line of the same reply adds keys, which replay fits like any other
// per-reply bookkeeping (a list append inside a scratch field would not be).
export function lootItems(offer) {
    const items = offer?.items;
    if (!isPlainObject(items)) return null;
    const keys = Object.keys(items);
    if (keys.some((key, at) => key !== String(at))) return null;
    return keys.map(key => items[key]);
}
