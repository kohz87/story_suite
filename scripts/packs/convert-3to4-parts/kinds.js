// The job: giving a format 3 pack's place and route kinds an engine class (pack format 4 §1: every kind used is mapped or a class). A pack that already has
// `placeKinds` / `routeKinds` keeps them; a kind it uses without a mapping gets the class below, or `site` / `none` when the table does not know it. What was added is listed for the author.
const PLACE = {
    capital: 'capital', city: 'city', 'fortress city': 'city', town: 'town', settlement: 'town', port: 'town', 'lock town': 'town', village: 'village',
    outpost: 'outpost', fort: 'outpost', fortress: 'outpost', 'watch-fort': 'outpost', camp: 'outpost', depot: 'outpost',
    site: 'site', district: 'site', quay: 'site', yard: 'site', storehouse: 'site', smithy: 'site', inn: 'site', 'guild office': 'site', culvert: 'site', bluff: 'site',
    shrine: 'site', ruin: 'site', pass: 'site', wild: 'none', sea: 'none', range: 'none', dungeon: 'none',
};
const ROUTE = {
    road: 'road', street: 'road', 'local road': 'road', 'caravan road': 'road', 'frontier road': 'road', tunnel: 'road', 'bastion road': 'relay-road', 'mountain road': 'pass',
    trail: 'trail', track: 'trail', 'hidden path': 'trail', river: 'river', 'sea lane': 'sea', 'deep-sea lane': 'sea', 'dungeon access': 'none',
};
const PLACE_CLASSES = ['capital', 'city', 'town', 'village', 'outpost', 'site', 'none'];
const ROUTE_CLASSES = ['relay-road', 'road', 'trail', 'river', 'sea', 'pass', 'none'];

function mapKinds(used, given, table, classes, fallback, label, notes) {
    const map = { ...(given ?? {}) };
    for (const kind of [...new Set(used)].filter(Boolean).sort()) {
        if (Object.hasOwn(map, kind) || classes.includes(kind)) continue;
        map[kind] = table[kind] ?? fallback;
        notes.dropped.push(`${label} "${kind}" was ${table[kind] ? 'mapped' : 'not known, so mapped'} to the engine class "${map[kind]}" (placeKinds / routeKinds)`);
    }
    return Object.keys(map).length ? map : null;
}

/** → `{ placeKinds, routeKinds }` (null when none are needed); notes get a line for each kind this added. */
export function kindMaps(content, notes) {
    return {
        placeKinds: mapKinds((content.places ?? []).map(place => place.kind), content.placeKinds, PLACE, PLACE_CLASSES, 'site', 'place kind', notes),
        routeKinds: mapKinds((content.routes ?? []).map(route => route.kind), content.routeKinds, ROUTE, ROUTE_CLASSES, 'none', 'route kind', notes),
    };
}
