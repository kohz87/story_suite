// The map widget's trip ids onto its map nodes: `atlas.trip` names its stops by canonical place id (the pack's definition id, or the atlas's own),
// the map's nodes are the atlas id or `pack:<key>` of a place the story has not minted yet. Pure.

const norm = value => String(value ?? '').normalize('NFKC').replace(/['’‘`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The trip with every stop id turned into the id of the map node it is: the node with that id already, else the one the stop's name (or an alias)
 * finds. A stop no node answers to keeps its id (it draws nothing, as before). `you` has no names, so it follows the ids the legs and movers settled.
 */
export function anchorTrip(trip, places) {
    if (!trip) return trip;
    const byId = new Set(places.map(place => place.id));
    const byName = new Map();
    for (const place of places) for (const name of [place.name, ...place.aliases]) if (norm(name) && !byName.has(norm(name))) byName.set(norm(name), place.id);
    const settled = new Map();
    const node = (id, name) => {
        if (byId.has(id)) return id;
        const found = byName.get(norm(name)) ?? settled.get(id) ?? id;
        settled.set(id, found);
        return found;
    };
    const legs = trip.legs.map(leg => ({ ...leg, fromId: node(leg.fromId, leg.from), toId: node(leg.toId, leg.to) }));
    const movers = trip.movers.map(item => ({ ...item, fromId: node(item.fromId, item.from), toId: node(item.toId, item.to) }));
    const you = trip.you ? { ...trip.you, fromId: node(trip.you.fromId, ''), toId: node(trip.you.toId, '') } : null;
    return { ...trip, legs, movers, you };
}
