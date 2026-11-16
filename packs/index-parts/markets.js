// Works out the packs.markets answer from the enabled packs and the lorebook's market places.

const copy = value => JSON.parse(JSON.stringify(value));

/**
 * `packs.markets`' answer from the enabled packs (in list order) and the lorebook's market places
 * (lorebook.js marketEntries): `{ types: [{ type, buy?, sell?, stock?, note?, pack }], tags: [{ tag,
 * prices, note?, pack }], places: [{ place, aliases, type, tags, buy?, sell?, from, pack? }] }`. A type
 * or tag two packs define is the earlier pack's; a place the lorebook names comes before the packs' own.
 */
export function marketsOf(list, lorePlaces = []) {
    const types = [];
    const tags = [];
    const places = [];
    const known = place => places.some(other => [other.place, ...other.aliases].some(name => name.toLowerCase() === place.toLowerCase()));
    for (const entry of Array.isArray(lorePlaces) ? lorePlaces : []) {
        if (!entry?.place || known(entry.place)) continue;
        places.push({ ...copy(entry), from: 'lorebook' });
    }
    for (const pack of Array.isArray(list) ? list : []) {
        for (const record of pack.content.markets ?? []) {
            if (record.type && !types.some(other => other.type === record.type)) types.push(copy(record));
            if (record.tag && !tags.some(other => other.tag === record.tag)) tags.push(copy(record));
        }
        for (const place of pack.content.places ?? []) {
            if (!place.market && !place.tags?.length) continue;
            if (known(place.name)) continue;
            places.push({ place: place.name, aliases: [...(place.aliases ?? [])], type: place.market ?? null, tags: [...(place.tags ?? [])], from: 'pack', pack: pack.id });
        }
    }
    return { types, tags, places };
}
