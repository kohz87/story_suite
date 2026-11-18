// Story Director v2, world: how long a courier takes between two places of the packs' map (spec §1 route classes, §4 news; seam
// audit E26, E27: the engine's own table, apart from party travel; exact days, no rounding, no rest days, no straight-line guess).
// Each route's class comes from the pack's `routeKinds` (or the kind is a class itself): relay-road 135 km/day, road 60, trail 35,
// river 60 (barge), pass 60 (as a road; a closing condition blocks it), sea its `hours` (else km at the ship pace, 110 km/day),
// none never. A route whose kind maps to no class (a pack written before route kinds) goes at the reader's courier pace. `factor`
// multiplies a route's time (a ×0.5 speed is 2, a placeStatus end 2, blocked Infinity: the route is not used). Pure.

const DAY_HOURS = 24;
/** Courier km a day by route class (the midpoints of spec §1); `sea` is the ship pace for a lane with no `hours`. */
export const CLASS_SPEED = Object.freeze({ 'relay-road': 135, road: 60, trail: 35, river: 60, pass: 60, sea: 110 });
const CLASSES = new Set([...Object.keys(CLASS_SPEED), 'none']);
const low = text => String(text ?? '').trim().toLowerCase();
const tidy = value => Math.round(value * 1e6) / 1e6;

/** The engine class of a route kind (`routeKinds` maps a pack's own kinds), or null when it maps to none of them. */
export function routeClass(kind, routeKinds = {}) {
    const mapped = Object.entries(routeKinds ?? {}).find(([key]) => low(key) === low(kind))?.[1];
    if (CLASSES.has(low(mapped))) return low(mapped);
    return CLASSES.has(low(kind)) ? low(kind) : null;
}

// One route's courier days, or null (class none, no km, or blocked).
function routeDays(route, klass, { pace, factor }) {
    if (klass === 'none' || !(factor > 0) || !Number.isFinite(factor)) return null;
    const km = Number.isFinite(route.km) && route.km > 0 ? route.km : null;
    let days = null;
    if (klass === 'sea' && Number.isFinite(route.hours) && route.hours > 0) days = route.hours / DAY_HOURS;
    else if (km !== null) days = km / (klass ? CLASS_SPEED[klass] : pace);
    return days === null ? null : days * factor;
}

// The graph of usable routes: place name → [{ to, days, km }], each route both ways.
function edgesOf({ geo, routes = [], routeKinds = {}, pace = CLASS_SPEED.road, factorOf = () => 1 }) {
    const edges = new Map();
    for (const route of routes) {
        const a = geo.byName.get(low(route?.from))?.name;
        const b = geo.byName.get(low(route?.to))?.name;
        if (!a || !b) continue;
        // A nameless route is "From-To" as the pack wrote its ends (an id or a name), the key geo.js and the conditions store keep it under.
        const name = typeof route.name === 'string' && route.name.trim() ? route.name.trim() : `${String(route.from).trim()}-${String(route.to).trim()}`;
        const days = routeDays(route, routeClass(route.kind, routeKinds), { pace, factor: factorOf(name) });
        if (days === null) continue;
        const km = Number.isFinite(route.km) && route.km > 0 ? route.km : 0;
        for (const [x, y] of [[a, b], [b, a]]) edges.set(x, [...(edges.get(x) ?? []), { to: y, days, km }]);
    }
    return edges;
}

// A district with no road of its own goes by its city's.
function nodeOf(geo, edges, name) {
    const place = geo.byName.get(low(name));
    if (!place) return null;
    return edges.has(place.name) || !place.parent ? place.name : place.parent;
}

/**
 * Every place's courier `{ days, km, hops }` from place `from` (one shortest-path run; routes go both ways, so it is also the time
 * to `from`): a Map by place name, empty for a place the map does not know. `env`: `{ geo, routes, routeKinds, pace, factorOf }`.
 */
export function courierMap(env, from) {
    // The graph is built once per question (kept on `env`, which news.js makes fresh for each one).
    const edges = env.edges ?? (env.edges = edgesOf(env));
    const start = nodeOf(env.geo, edges, from);
    const best = new Map(start ? [[start, { days: 0, km: 0, hops: 0 }]] : []);
    const open = new Set(start ? [start] : []);
    const done = new Set();
    while (open.size) {
        // The nearest open place; ties by name, so the answer never depends on route order.
        const at = [...open].sort((x, y) => best.get(x).days - best.get(y).days || (x < y ? -1 : 1))[0];
        open.delete(at);
        done.add(at);
        const here = best.get(at);
        for (const edge of edges.get(at) ?? []) {
            if (done.has(edge.to)) continue;
            const days = tidy(here.days + edge.days);
            if (days < (best.get(edge.to)?.days ?? Infinity)) {
                best.set(edge.to, { days, km: tidy(here.km + edge.km), hops: here.hops + 1 });
                open.add(edge.to);
            }
        }
    }
    return { best, node: name => nodeOf(env.geo, edges, name) };
}

/**
 * `{ days, km, hops }` for news from place `from` to place `to` (names of `geo`), or null when no chain of usable routes joins them.
 * `env.cache` (a Map), when given, keeps one run per `to` for every entry asked about in the same question.
 */
export function courierDays(env, from, to) {
    const run = env.cache?.get(to) ?? courierMap(env, to);
    env.cache?.set(to, run);
    const node = run.node(from);
    return node ? run.best.get(node) ?? null : null;
}
