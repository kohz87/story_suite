// The job: a format 4 pack's `start` in the shape mergeStart merges: the world's place and world state, the game's money and items.

import { foldKey } from '../../core/text.js';
import { slugify } from '../validate/core.js';
import { defaultDef } from '../../modules/inventory/state.js';
import { itemDef } from './items.js';

/**
 * `{ scene: { place, present: [] }, inventory: { items: [{ def, aliases, qty, note }], money }, world? }` for a world or game pack, or null when it starts nothing.
 * A world's `place` (a place id of its own) becomes the scene's place; its `date` is read with the calendar (tables.js). A game's item names are matched to
 * `worldItems` (the selected world's items, by name or alias) and an unmatched name gets a plain `story/<slug>` def, the one the inventory makes for any story name.
 */
export function startOf4(pack, worldItems = []) {
    const start = pack.start;
    if (!start) return null;
    const out = { scene: { place: null, present: [] }, inventory: { items: [], money: 0 } };
    if (pack.kind === 'world') {
        const place = start.place ? (pack.content.places ?? []).find(record => record.slug === start.place) : null;
        // (a place names its region by id; the scene keeps the region's name, as format 3 did)
        const region = (pack.content.regions ?? []).find(record => record.id === place?.region);
        if (place) out.scene.place = { name: place.name, kind: place.kind ?? '', region: region?.name ?? place.region ?? '' };
        if (start.world) out.world = start.world;
        return out;
    }
    out.inventory.money = start.money ?? 0;
    for (const line of start.items ?? []) {
        const key = foldKey(line.name);
        const item = worldItems.find(record => foldKey(record.name) === key || record.aliases.some(alias => foldKey(alias) === key));
        out.inventory.items.push(item
            ? { def: itemDef(item), aliases: [...item.aliases], qty: line.qty, note: line.note }
            : { def: defaultDef(`story/${slugify(line.name)}`, line.name), aliases: [], qty: line.qty, note: line.note });
    }
    return out;
}
