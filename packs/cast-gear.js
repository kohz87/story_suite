// A cast member's signature gear (`story-block.gear`, docs/v2/GEAR.md "Signature gear"): the pack items a person brings when they join the
// party, and the one "Gear:" line the narrator's cast entry may carry while they are not in it. Pure: the enabled packs in, plain rows out.

import { foldKey, oneLine } from '../core/text.js';
import { slotWordOf } from '../modules/inventory/gear.js';

/**
 * The cast entry a name means (its name or an alias, folded) and the pack items of its `gear`, in the order written:
 * `{ id, name, aliases, pack, items: [{ id, name, slot }] }` or null. `packs`: the enabled packs (`packs.packs()`); the first pack with the person wins.
 */
export function castGearOf(packs, name) {
    const key = foldKey(oneLine(name));
    if (!key) return null;
    for (const pack of Array.isArray(packs) ? packs : []) {
        const person = (pack?.content?.cast ?? []).find(entry => [entry.name, ...(entry.aliases ?? [])].some(each => foldKey(each) === key));
        if (!person) continue;
        const byId = new Map((pack.content.items ?? []).map(item => [item.id, item]));
        const items = (person.gear ?? []).map(id => byId.get(id)).filter(item => item && item.kind === 'equipment' && slotWordOf(item.slot))
            .map(item => ({ id: item.id, name: item.name, slot: slotWordOf(item.slot) }));
        return { id: person.id, name: person.name, aliases: [...(person.aliases ?? [])], pack: pack.id, items };
    }
    return null;
}

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
