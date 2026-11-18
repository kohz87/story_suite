// A person's gear words (docs/v2/GEAR.md): the one "Gear:" line, and the pack equipment a person's keepsakes name. Pure: the selected packs in, plain rows out.

import { foldKey, oneLine } from '../core/text.js';
import { slotWordOf } from '../modules/inventory/gear.js';

/** The narrator's short line: `Gear: Cane Sword, Oak Buckler`, or '' for no gear. */
export const gearLine = items => (items.length ? `Gear: ${items.map(item => item.name).join(', ')}` : '');

/**
 * The pack equipment a person's keepsakes name (pack format 4: NPC State's Keepsakes, by name or alias, folded), in the order held: `[{ id, name, slot }]`. A keepsake no pack item
 * of that name matches (or one that is not equipment with a slot) is prose only and is left out. `packs`: the selected packs (`packs.packs()`); the first item of that name wins.
 */
export function keepsakeGearOf(packs, names) {
    const out = [], seen = new Set();
    for (const name of Array.isArray(names) ? names : []) {
        const key = foldKey(oneLine(name));
        if (!key) continue;
        for (const pack of Array.isArray(packs) ? packs : []) {
            const item = (pack?.content?.items ?? []).find(each => each.kind === 'equipment' && slotWordOf(each.slot) && [each.name, ...(each.aliases ?? [])].some(label => foldKey(label) === key));
            if (!item || seen.has(item.id)) continue;
            seen.add(item.id);
            out.push({ id: item.id, name: item.name, slot: slotWordOf(item.slot) });
            break;
        }
    }
    return out;
}
