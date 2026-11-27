// Where a scene's place is on the pack's map: the one reading of the world note, the World tab and the daily step's party region. A place
// no pack names is read as the pack place (or the region) it stands for (atlas.anchor; LAB2-3), as the news does. Pure.

import { ask } from '../queries-parts/shared-ask.js';
import { hostGeo } from '../conditions/known-refs.js';

const low = text => String(text ?? '').trim().toLowerCase();

// The region id the conditions are stored under, for a region given by name or alias ("Bluewatch Reach" a place the story made says, not the pack's id "bluewatch-reach").
function regionId(geo, region) {
    const key = low(region);
    if (!key || geo.regions.has(key)) return region;
    const shown = geo.regionNames?.get(key);
    const same = shown ? [...geo.regions.keys()].find(id => geo.regionNames.get(id) === shown) : null;
    return same ? geo.regions.get(same) : region;
}

/** `{ geo, place, region }` for the place name `scene`: the pack place (else the name as given) and its region (id; '' when none is known). `query(name, args)` asks the engine. */
export function sceneSpot(query, scene) {
    const anchor = ask(query, 'atlas.anchor', { name: scene });
    const known = ask(query, 'atlas.place', { name: anchor?.name || scene });
    const named = typeof known?.name === 'string' && known.name.trim() ? known.name.trim() : scene;
    const geo = hostGeo((name, args) => ask(query, name, args));
    // A place the story set in a region it names ("~ place Auvoth Frontier Road | region: Bluewatch Reach") is in that region, whatever pack town its name starts with (LA-1).
    const sceneRegion = ask(query, 'scene.place', {});
    const own = low(sceneRegion?.name) === low(scene) && geo.regions.has(low(regionId(geo, sceneRegion?.region))) ? regionId(geo, sceneRegion.region) : '';
    const elsewhere = own && low(own) !== low(regionId(geo, known?.region || anchor?.region));
    return { geo, place: elsewhere ? scene : named, region: String((elsewhere ? own : regionId(geo, known?.region || anchor?.region)) ?? '') };
}
