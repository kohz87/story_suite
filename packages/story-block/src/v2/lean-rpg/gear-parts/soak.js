// The soak record of one member's gear: what the owners' worn pieces soak, from the inventory's `inventory.gear` answers. Not wired to the fight engine yet.
import { isObject } from './shared-helpers.js';
import { NAME_MAX, ITEMS_MAX } from './shared-caps.js';

/** `{ total, items: [{ name, soak }] }` over the owners `own` (`answerOf(owner)` is the `inventory.gear` answer); torn and broken pieces are already left out by the inventory. */
export function soakOf(own, answerOf) {
    const items = [];
    for (const owner of own) {
        const pieces = answerOf(owner)?.soak?.pieces;
        if (!Array.isArray(pieces)) continue;
        for (const piece of pieces) if (isObject(piece) && typeof piece.name === 'string' && Number.isSafeInteger(piece.soak) && piece.soak > 0) items.push({ name: piece.name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX), soak: piece.soak });
    }
    const kept = items.slice(0, ITEMS_MAX);
    return { total: kept.reduce((sum, item) => sum + item.soak, 0), items: kept };
}
