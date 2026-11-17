// World events, the daily step: the pack's map as the step reads it (spec v0.10 §1): places with their region, class and
// weight; regions with their realm (a region in no realm is wild: the Wilds, one virtual realm for caps); routes by name.
// Names and ids compare without case; the canonical name is the one the pack wrote. A place named "City / Part" sits under the
// place "City" when the pack has it (`parent`: a district; spec §2 a placeStatus on a city covers its districts). Pure.

export const WILDS = 'the Wilds';
const CLASSES = Object.freeze(['capital', 'city', 'town', 'village', 'outpost', 'site', 'none']);
/** Generic placement weight by place class: capital/city > town > village > outpost (= site); none is never picked. */
export const CLASS_WEIGHT = Object.freeze({ capital: 8, city: 6, town: 4, village: 2, outpost: 1, site: 1, none: 0 });
const low = text => String(text ?? '').trim().toLowerCase();
const text = value => (typeof value === 'string' && value.trim() ? value.trim() : '');

/** The map of a world `{ places, routes, realms, placeKinds }` → lookups used by every other part of the step. */
export function buildGeo(world = {}) {
    const placeKinds = world.placeKinds && typeof world.placeKinds === 'object' ? world.placeKinds : {};
    const regionRealm = new Map();
    const realms = new Map();
    const regions = new Map();
    for (const realm of Array.isArray(world.realms) ? world.realms : []) {
        const name = text(realm?.name);
        if (!name) continue;
        realms.set(low(name), name);
        if (text(realm?.id)) realms.set(low(realm.id), name);
        for (const region of Array.isArray(realm.regions) ? realm.regions : []) {
            if (!text(region)) continue;
            regionRealm.set(low(region), name);
            regions.set(low(region), text(region));
        }
    }
    const places = [];
    const byName = new Map();
    for (const raw of Array.isArray(world.places) ? world.places : []) {
        const name = text(raw?.name);
        if (!name) continue;
        const region = text(raw.region);
        const kind = text(raw.kind);
        const klass = CLASSES.includes(placeKinds[kind]) ? placeKinds[kind] : CLASSES.includes(kind) ? kind : 'town';
        const place = {
            name, id: text(raw.id) || name, region, kind, klass,
            realm: region ? regionRealm.get(low(region)) ?? WILDS : WILDS,
            weight: Number.isFinite(raw.weight) && raw.weight >= 0 ? raw.weight : null,
            x: Number.isFinite(raw.x) ? raw.x : 0, y: Number.isFinite(raw.y) ? raw.y : 0,
            parent: null, hidden: raw.hidden === true || raw.secret === true,
        };
        places.push(place);
        for (const key of [name, place.id, ...(Array.isArray(raw.aliases) ? raw.aliases : [])]) if (text(key)) byName.set(low(key), place);
        if (region && !regions.has(low(region))) regions.set(low(region), region);
    }
    places.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const place of places) {
        const slash = /^(.+?) \/ (.+)$/.exec(place.name);
        const parent = slash ? byName.get(low(slash[1])) : null;
        if (parent && parent !== place) place.parent = parent.name;
    }
    const routes = new Map();
    for (const raw of Array.isArray(world.routes) ? world.routes : []) {
        const from = text(raw?.from);
        const to = text(raw?.to);
        if (!from || !to) continue;
        // The default name is the one the conditions store keeps a route under ("From-To", conditions/known-refs.js), so both agree.
        const name = text(raw.name) || `${from}-${to}`;
        const route = { name, from, to };
        for (const key of [name, `${from}-${to}`, `${from}–${to}`, text(raw.corridor)]) if (key) routes.set(low(key), route);
    }
    return { places, byName, regions, regionRealm, realms, routes };
}

/** What a ref names: `{ kind: 'place'|'region'|'realm'|'route', name, place? }`, or null. Place → region → realm, most specific first. */
export function resolveRef(geo, ref) {
    const key = low(ref);
    if (!key) return null;
    if (geo.byName.has(key)) return { kind: 'place', name: geo.byName.get(key).name, place: geo.byName.get(key) };
    if (geo.regions.has(key)) return { kind: 'region', name: geo.regions.get(key) };
    if (geo.realms.has(key)) return { kind: 'realm', name: geo.realms.get(key) };
    if (key === low(WILDS)) return { kind: 'realm', name: WILDS };
    if (geo.routes.has(key)) return { kind: 'route', name: geo.routes.get(key).name };
    return null;
}
