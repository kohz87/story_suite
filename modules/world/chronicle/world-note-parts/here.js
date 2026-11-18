// The world conditions that hold where the scene is, with what the pack declares for each (the world note's and the World tab's one reading). Pure.

import { ask } from '../queries-parts/shared-ask.js';
import { hostGeo } from '../conditions/known-refs.js';
import { regionLabel } from '../../daily/region-label.js';

const low = text => String(text ?? '').trim().toLowerCase();

// The region id the conditions are stored under, for a region given by name or alias ("Bluewatch Reach" a place the story made says, not the pack's id "bluewatch-reach").
function regionId(geo, region) {
    const key = low(region);
    if (!key || geo.regions.has(key)) return region;
    const shown = geo.regionNames?.get(key);
    const same = shown ? [...geo.regions.keys()].find(id => geo.regionNames.get(id) === shown) : null;
    return same ? geo.regions.get(same) : region;
}

/**
 * The conditions that hold at `scene`, narrowest first: its place (and city), the routes from it, its region, its realm; each is the
 * `chronicle.conditions` entry with `declared` (the pack's `{ means, effects, placeStatus… }`, `{}` when it declares none). `query(name, args)` asks the engine.
 */
export function hereConditions(query, scene) {
    const declared = new Map((ask(query, 'chronicle.conditionNames', {}) ?? []).map(entry => [entry.name, entry]));
    // A place no pack names reads the conditions of the pack place (or the region) it stands for (atlas.anchor; LAB2-3), as the news does.
    const anchor = ask(query, 'atlas.anchor', { name: scene });
    const known = ask(query, 'atlas.place', { name: anchor?.name || scene });
    const named = typeof known?.name === 'string' && known.name.trim() ? known.name.trim() : scene;
    const geo = hostGeo((name, args) => ask(query, name, args));
    // A place the story set in a region it names ("~ place Auvoth Frontier Road | region: Bluewatch Reach") is in that region, whatever pack town its name starts with (LA-1).
    const sceneRegion = ask(query, 'scene.place', {});
    const own = low(sceneRegion?.name) === low(scene) && geo.regions.has(low(regionId(geo, sceneRegion?.region))) ? regionId(geo, sceneRegion.region) : '';
    const elsewhere = own && low(own) !== low(regionId(geo, known?.region || anchor?.region));
    const place = elsewhere ? scene : named;
    const region = elsewhere ? own : regionId(geo, known?.region || anchor?.region);
    const at = ask(query, 'chronicle.conditions', { at: place, ...(region ? { region } : {}) }) ?? [];
    const routes = [...new Set([...geo.routes.values()].filter(route => low(route.from) === low(place) || low(route.to) === low(place)).map(route => route.name))].sort();
    const onRoutes = routes.flatMap(route => ask(query, 'chronicle.conditions', { at: route }) ?? []).map(entry => ({ ...entry, level: 0.5 }));
    const seen = new Set();
    return [...at, ...onRoutes].sort((a, b) => a.level - b.level).filter(entry => !seen.has(entry.key) && seen.add(entry.key))
        .map(entry => ({ ...entry, ...(entry.scope === 'region' ? { ref: regionLabel(geo, entry.ref) } : {}), declared: declared.get(entry.name) ?? {} }));
}
