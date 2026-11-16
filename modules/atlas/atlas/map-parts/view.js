// Builds the atlas Map widget view data and layer keys.

import { keyOf } from '../domain.js';
import { placeLine } from '../parent.js';
import { iconFor, label } from './icons.js';

const layerKey = (type, name) => `${type}:${keyOf(name)}`;

/** The layer a place shows on in the atlas widget: its plane's, else its region's, else '' (only "All"). */
export const viewLayerOf = place => (place.layer ? layerKey('plane', place.layer) : place.region ? layerKey('region', place.region) : '');

/**
 * The atlas widget's data:
 * `{ places, routes, layers, layer, current, kinds, orient }` where
 * - places: `[{ id, name, aliases, region, kind, icon, plane, layer, x, y, visited, here }]`, every
 *   place but a hidden one the story has not reached (`x`/`y` null without coordinates);
 * - routes: `[{ from, to, kind, known }]` between those (`known`: both ends visited);
 * - layers: `[{ id, name, type: 'region' | 'plane' }]`, only those with at least one place, regions
 *   first, each by name; `layer`: the one to open on (the current place's, else '' for all);
 * - kinds: the legend `{ kind: { label, icon? } }`; orient: `{ north, east }` from the map settings.
 */
export function atlasView(world, current = '', { map = {} } = {}) {
    const here = current ? world.find(current) : null;
    const drawn = world.places.filter(place => !place.hidden || place.id === here?.id);
    const ids = new Set(drawn.map(place => place.id));
    const visited = new Set(drawn.filter(place => place.discovered || place.id === here?.id).map(place => place.id));
    // A town counts as visited when a place inside it is (derived, nothing stored).
    for (const place of drawn.filter(item => item.parent && visited.has(item.id))) if (ids.has(place.parent)) visited.add(place.parent);
    const kinds = {};
    const layers = new Map();
    // The places inside a drawn place (parent.js): a dot round it, counted on its label.
    const inside = new Map();
    for (const place of drawn) if (place.parent && ids.has(place.parent)) inside.set(place.parent, (inside.get(place.parent) ?? 0) + 1);
    const places = drawn.map(place => {
        const icon = iconFor(place.kind);
        if (place.kind && !kinds[place.kind]) kinds[place.kind] = { label: label(place.kind), icon };
        const layer = viewLayerOf(place);
        if (layer && !layers.has(layer)) layers.set(layer, { id: layer, name: place.layer || place.region, type: place.layer ? 'plane' : 'region' });
        return {
            id: place.id, name: place.name, aliases: [...(place.aliases ?? [])], region: place.region, kind: place.kind, icon,
            plane: place.layer, layer, x: place.x, y: place.y, line: placeLine(place, world),
            parent: place.parent && ids.has(place.parent) ? place.parent : '', inside: inside.get(place.id) ?? 0, visited: visited.has(place.id), here: place.id === here?.id,
        };
    });
    const routes = world.routes.filter(route => ids.has(route.from) && ids.has(route.to)).map(route => {
        if (route.kind && !kinds[route.kind]) kinds[route.kind] = { label: label(route.kind) };
        return { from: route.from, to: route.to, kind: route.kind, known: visited.has(route.from) && visited.has(route.to) };
    });
    const order = { region: 0, plane: 1 };
    return {
        places,
        routes,
        layers: [...layers.values()].sort((a, b) => order[a.type] - order[b.type] || keyOf(a.name).localeCompare(keyOf(b.name)) || (a.id < b.id ? -1 : 1)),
        layer: here ? viewLayerOf(here) : '',
        current: here && ids.has(here.id) ? here.id : '',
        kinds,
        // "Tidy the map" is offered while a visited atlas place has no coordinates (atlas.edit { tidy: true }); the `atlas.view` query
        // narrows this count to the places a tidy can place (queries.js).
        tidy: drawn.filter(place => place.source === 'atlas' && place.discovered && place.x === null).length,
        orient: { north: map?.north === 'down' ? 'down' : 'up', east: map?.east === 'left' ? 'left' : 'right' },
    };
}
