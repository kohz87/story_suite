// The groups a roll opened and the groups of a won board fight the block no longer shows.

import { RESOLVE } from '../names.js';
import { foeLevel } from './levels.js';
import { isObject, whole } from './shared-values.js';

/** The groups every `rpg.resolve` receipt of the reply opened (their `result.opened`), by slot; in order, a later receipt's entry for the same slot wins (the foe pre-check and the board fight are two receipts). */
function openedEntries(receipts) {
    const out = new Map();
    for (const receipt of Array.isArray(receipts) ? receipts : []) {
        const opened = receipt?.type === RESOLVE && isObject(receipt.data?.v2?.result) ? receipt.data.v2.result.opened : null;
        if (Array.isArray(opened)) for (const entry of opened) if (isObject(entry)) out.set(entry.slot, entry);
    }
    return out;
}

/** The groups of a won board fight when the Foes block no longer shows them Down: from the sheet if it still does, else the roll's own opened foes, else the sheet the reply began with. */
export function boardGroups(sheet, earlier, was, receipts) {
    const down = new Map(sheet.foes.filter(foe => foe.filled && foe.hurt === 0).map(foe => [foe.slot, foe]));
    const opened = openedEntries(receipts);
    const began = new Map(earlier.foes.filter(foe => foe.filled).map(foe => [foe.slot, foe]));
    return was.flatMap(slot => {
        const foe = down.get(slot) ?? (opened.has(slot) ? opened.get(slot) : began.get(slot));
        return foe && typeof foe.name === 'string' && foe.name && whole(foe.count) && foe.count > 0 ? [{ slot, name: foe.name.slice(0, 120), count: Math.min(999, foe.count), level: foeLevel(foe) }] : [];
    });
}

/** The foe slots this reply's roll put a group in (its `rpg.resolve` receipt's `result.opened`, open.js): a group that took a Down group's slot is a new one. */
export function openedSlots(receipts) {
    return [...openedEntries(receipts).keys()].filter(slot => Number.isSafeInteger(slot) && slot >= 1);
}
