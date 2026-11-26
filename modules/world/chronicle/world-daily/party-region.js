// World events, the daily step on the host: the region the party is in, from stored state only: the scene's place on the pack's map, read
// as the world note reads it (world-note-parts/spot.js). '' when no place is known. Pure.

import { scenePlaceOf } from '../pick-parts/nearness.js';
import { sceneSpot } from '../world-note-parts/spot.js';

/** `partyRegionOf(query, state)` → the region's id as the pack writes it, or ''. */
export function partyRegionOf(query, state = null) {
    const scene = scenePlaceOf(query, state);
    return scene ? sceneSpot(query, scene).region : '';
}
