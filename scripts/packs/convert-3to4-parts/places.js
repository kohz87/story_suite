// The job: making a format 3 pack's places and routes fit a format 4 world: every place gets an `id` (its name as a slug, made unique), and a region text with "@" or ": " (which the
// world format refuses) is written with " - " instead. A place that already has an id, and a pack whose places need neither, come back unchanged. What was changed is listed for the author.
const slug = text => String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'place';

/** A slug of `name` that is not in the set `taken`. */
const freshId = (taken, name) => {
    let id = slug(name);
    for (let n = 2; taken.has(id); n += 1) id = `${slug(name)}-${n}`;
    return id;
};

/** → the places, each with an id. */
export function placesWithIds(places, notes) {
    if (!places?.length) return places;
    const taken = new Set(places.map(place => place.id).filter(Boolean));
    let regionsRenamed = new Set();
    const out = places.map(place => {
        let next = place;
        if (!place.id) {
            const id = freshId(taken, place.name);
            taken.add(id);
            next = { id, ...next };
        }
        if (typeof place.region === 'string' && /@|: /.test(place.region)) {
            regionsRenamed.add(place.region);
            next = { ...next, region: place.region.replace(/@/g, ' at ').replace(/: /g, ' - ') };
        }
        return next;
    });
    if (out.some((place, i) => place !== places[i] && !places[i].id)) notes.dropped.push('places had no `id`: each now has one made from its name (the routes still name places by name)');
    for (const region of regionsRenamed) notes.dropped.push(`the place region "${region}" had "@" or ": " in it; the world format refuses both, so it is written with " - "`);
    return out;
}

/** → the routes; when two or more join the same two places, each of them gets a `name` ("<from>–<to> (<corridor or kind>)") so the names are unique. */
export function routesNamed(routes, notes) {
    if (!routes?.length) return routes;
    const pair = route => [route.from, route.to].map(name => String(name).toLowerCase()).sort().join('\u0000');
    const count = new Map();
    for (const route of routes) count.set(pair(route), (count.get(pair(route)) ?? 0) + 1);
    let named = 0;
    const out = routes.map(route => {
        if (route.name || count.get(pair(route)) < 2) return route;
        named += 1;
        return { ...route, name: `${route.from}–${route.to} (${route.corridor ?? route.kind})` };
    });
    if (named) notes.dropped.push(`${named} routes join the same two places as another route: each now has a \`name\` (the world format needs one)`);
    return out;
}

/** → the places with the start place added when the pack's `start.scene.place` is a place record (name, kind, region) that no place of the pack has: a world's start is a place id, so it needs the place. Run it after `placesWithIds`. */
export function withStartPlace(places, scenePlace, notes) {
    if (!scenePlace || typeof scenePlace !== 'object' || typeof scenePlace.name !== 'string') return places;
    const known = (places ?? []).some(place => [place.id, place.name, ...(place.aliases ?? [])].some(name => String(name ?? '').toLowerCase() === scenePlace.name.toLowerCase()));
    if (known) return places;
    notes.dropped.push(`start.scene.place "${scenePlace.name}" was not one of the pack's places: it is added as a place, the world's start place`);
    const { name, kind, region } = scenePlace;
    const id = freshId(new Set((places ?? []).map(place => place.id)), name);
    return [...(places ?? []), { id, name, ...(kind ? { kind } : {}), ...(region ? { region } : {}), x: 0, y: 0 }];
}
