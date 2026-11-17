// The job: the lookups every world-pack check shares: what a ref, a condition, a power, a score, a person or an event id names in this pack.

import { foldKey } from '../../../core/text.js';
import { PLACE_CLASSES } from '../../limits.js';

const SLUGGY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const dash = text => foldKey(String(text).replace(/[–—]/g, '-'));
export const routeNameOf = route => route.name ?? `${route.from}–${route.to}`;

/**
 * Builds the index from the normalized content kinds. `ref(text)` → the set of scopes a place, route, region or realm reference can mean
 * (by id first, then by display name or alias); an empty set means it names nothing in this pack.
 */
export function buildIndex({ refused = new Set(), places = [], routes = [], realms = [], conditions = [], cast = [], powers = [], scores = [], worldEvents = [], legacyEvents = [], items = [], markets = [], weather = null, placeKinds = null }) {
    const byId = new Map();
    const byName = new Map();
    const note = (map, key, scope) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(scope); };
    for (const place of places) {
        note(byId, place.slug, 'place');
        for (const name of [place.name, ...(place.aliases ?? [])]) note(byName, foldKey(name), 'place');
        if (place.region) { note(byName, foldKey(place.region), 'region'); if (SLUGGY.test(place.region)) note(byId, place.region, 'region'); }
    }
    for (const realm of realms) {
        note(byId, realm.id, 'realm');
        note(byName, foldKey(realm.name ?? realm.id), 'realm');
        for (const region of realm.regions ?? []) { note(byName, foldKey(region), 'region'); if (SLUGGY.test(region)) note(byId, region, 'region'); }
    }
    const routeNames = new Set(routes.map(route => dash(routeNameOf(route))));
    const ref = text => {
        if (typeof text !== 'string' || !text.trim()) return new Set();
        const raw = text.trim();
        const found = new Set([...(byId.get(raw) ?? []), ...(byName.get(foldKey(raw)) ?? [])]);
        if (routeNames.has(dash(raw))) found.add('route');
        return found;
    };
    const tags = new Set(items.flatMap(item => item.tags ?? []));
    const categories = new Set([...tags, ...markets.flatMap(market => Object.keys(market.prices ?? {}))]);
    categories.delete('all');
    const seasons = new Set([...(weather?.seasons ?? []).map(season => foldKey(season.name ?? ''))]);
    return {
        ref,
        placeBySlug: slug => places.find(place => place.slug === slug) ?? null,
        placeByRef: text => places.find(place => place.slug === text || foldKey(place.name) === foldKey(text) || (place.aliases ?? []).some(alias => foldKey(alias) === foldKey(text))) ?? null,
        condition: name => conditions.find(entry => entry.name === name) ?? null,
        power: id => powers.find(entry => entry.id === id) ?? null,
        score: id => scores.find(entry => entry.id === id) ?? null,
        // An id, else a display name or alias that is unique (spec §6: a name is allowed where it names one entry); null when unknown or ambiguous.
        standing: (kind, text) => {
            const rows = kind === 'power' ? powers : scores;
            const exact = rows.find(entry => entry.id === text);
            if (exact) return exact;
            const named = rows.filter(entry => [entry.name, ...(entry.aliases ?? [])].some(word => foldKey(word) === foldKey(String(text))));
            return named.length === 1 ? named[0] : null;
        },
        refused,
        person: id => cast.find(entry => entry.id === id) ?? null,
        eventIds: new Set(worldEvents.map(event => event.id)),
        legacyIds: new Set(legacyEvents.map(event => event.slug ?? event.id)),
        categories,
        knowsSeason: name => SLUGGY.test(name) && (['spring', 'summer', 'autumn', 'winter'].includes(name) || seasons.has(foldKey(name))),
        placeKindKnown: kind => typeof kind === 'string' && (PLACE_CLASSES.includes(kind) || Object.hasOwn(placeKinds ?? {}, kind)),
        cast,
    };
}
