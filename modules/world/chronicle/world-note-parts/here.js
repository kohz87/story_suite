// The world conditions that hold where the scene is, with what the pack declares for each (the world note's and the World tab's one reading). Pure.

import { ask } from '../queries-parts/shared-ask.js';
import { sceneSpot } from './spot.js';
import { regionLabel } from '../../daily/region-label.js';

const low = text => String(text ?? '').trim().toLowerCase();

/**
 * The conditions that hold at `scene`, narrowest first: its place (and city), the routes from it, its region, its realm; each is the
 * `chronicle.conditions` entry with `declared` (the pack's `{ means, effects, placeStatus… }`, `{}` when it declares none). `query(name, args)` asks the engine.
 */
export function hereConditions(query, scene) {
    const declared = new Map((ask(query, 'chronicle.conditionNames', {}) ?? []).map(entry => [entry.name, entry]));
    const { geo, place, region } = sceneSpot(query, scene);
    const at = ask(query, 'chronicle.conditions', { at: place, ...(region ? { region } : {}) }) ?? [];
    const routes = [...new Set([...geo.routes.values()].filter(route => low(route.from) === low(place) || low(route.to) === low(place)).map(route => route.name))].sort();
    const onRoutes = routes.flatMap(route => ask(query, 'chronicle.conditions', { at: route }) ?? []).map(entry => ({ ...entry, level: 0.5 }));
    const seen = new Set();
    return [...at, ...onRoutes].sort((a, b) => a.level - b.level).filter(entry => !seen.has(entry.key) && seen.add(entry.key))
        .map(entry => ({ ...entry, ...(entry.scope === 'region' ? { ref: regionLabel(geo, entry.ref) } : {}), declared: declared.get(entry.name) ?? {} }));
}
