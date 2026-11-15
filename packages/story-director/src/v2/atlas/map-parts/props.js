// Builds Story Block ss.map widget props and layer names from an atlas world.

import { keyOf } from '../domain.js';
import { iconFor, label } from './icons.js';

/** The map layer a place is on: its plane, else its region, else none (shown on every layer). */
export const layerOf = place => place.layer || place.region || '';

/** `{ nodes, edges, layers, current, discovered, kinds }` for `ss.map`. */
export function mapProps(world, current = '') {
    const layers = [];
    const layerIds = new Map();
    const layerId = text => {
        const key = keyOf(text);
        if (!key) return '';
        if (!layerIds.has(key)) {
            layerIds.set(key, key);
            layers.push({ id: key, name: text });
        }
        return key;
    };
    const kinds = {};
    const drawn = world.places.filter(place => !place.hidden);
    const shown = new Set(drawn.map(place => place.id));
    const nodes = drawn.map(place => {
        const node = { id: place.id, name: place.name, icon: iconFor(place.kind), layer: layerId(layerOf(place)), kind: place.kind };
        if (place.x !== null && place.y !== null) Object.assign(node, { x: place.x, y: place.y });
        if (place.kind && !kinds[place.kind]) kinds[place.kind] = { label: label(place.kind), icon: node.icon };
        return node;
    });
    const edges = world.routes.filter(route => shown.has(route.from) && shown.has(route.to)).map(route => {
        if (route.kind && !kinds[route.kind]) kinds[route.kind] = { label: label(route.kind) };
        return { from: route.from, to: route.to, kind: route.kind };
    });
    const here = current ? world.find(current) : null;
    return {
        nodes,
        edges,
        layers: layers.sort((a, b) => a.id.localeCompare(b.id)),
        current: here?.id ?? '',
        discovered: drawn.filter(place => place.discovered).map(place => place.id),
        kinds,
    };
}
