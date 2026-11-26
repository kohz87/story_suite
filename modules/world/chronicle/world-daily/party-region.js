// World events, the daily step on the host: the regions the party counts as in, from stored state only: the scene's place on the pack's
// map, read as the world note reads it (world-note-parts/spot.js), and the player's holding's seat, read the same way. '' when no place
// is known. Pure.

import { scenePlaceOf } from '../pick-parts/nearness.js';
import { sceneSpot } from '../world-note-parts/spot.js';
import { regionKey } from '../../daily/near.js';
import { ask } from '../queries-parts/shared-ask.js';

/** `partyRegionOf(query, state)` → the scene's region id as the pack writes it, or ''. */
export function partyRegionOf(query, state = null) {
    const scene = scenePlaceOf(query, state);
    return scene ? sceneSpot(query, scene).region : '';
}

/** `seatRegionOf(query)` → the holding seat's region: the one its seat line named, when the map has it, else the seat place's; '' with no seat (or no holding switched on). */
export function seatRegionOf(query) {
    const holding = ask(query, 'dataModules.holding', {});
    const seat = String(holding?.seat ?? '').trim();
    if (!seat) return '';
    const spot = sceneSpot(query, seat);
    const named = String(holding.region ?? '').trim();
    return regionKey(spot.geo, named) ?? spot.region;
}
