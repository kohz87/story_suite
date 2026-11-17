// Story Director v2, world: where a place is on the map for news (spec §4 reach, §1 Place discovery). A place of the packs' map has
// its region, its realm and its city (a district's); a place only the atlas knows has the atlas's region. The Wilds are one realm
// for the caps only (spec §1): for news a wild place has no realm, so wild regions are not each other's realm. News stops at its
// `reach` (local: the same place or city; regional: the same region; realm: the same realm, or the same region in the Wilds; world,
// or none given: everywhere). News from a hidden or secret place the party has not reached names its region instead. Pure.

import { WILDS } from '../daily/geo.js';
import { lineKey } from '../changes.js';
import { queryOf, tryQuery } from './known-parts/query.js';
import { text } from './known-parts/shared-text.js';

const low = value => String(value ?? '').trim().toLowerCase();

/** `{ name, group, region, regionName, realm, hidden }` (`regionName`: the region's display name, else its id) of a place name (the packs' map, else the atlas), or null when neither knows it. */
export function placeInfo(geo, tools, name) {
    const own = geo.byName.get(low(name));
    if (own) return { name: own.name, group: own.parent ?? own.name, region: own.region, regionName: own.regionName, realm: own.realm === WILDS ? '' : own.realm, hidden: own.hidden === true };
    const atlas = tryQuery(queryOf(tools), 'atlas.place', { name }, null);
    if (!atlas) return null;
    const region = text(atlas.region);
    return { name: text(atlas.name) || name, group: text(atlas.name) || name, region, regionName: geo.regionNames?.get(low(region)) ?? region, realm: region ? geo.regionRealm.get(low(region)) ?? '' : '', hidden: false };
}

/** Whether news of `reach` from `origin` reaches `here` (place infos; an unknown one is not held back). */
export function withinReach(reach, origin, here) {
    if (!origin || !here || !reach || reach === 'world') return true;
    if (reach === 'local') return lineKey(origin.group) === lineKey(here.group) || lineKey(origin.name) === lineKey(here.name);
    if (reach === 'regional') return origin.region ? lineKey(origin.region) === lineKey(here.region) : withinReach('local', origin, here);
    if (reach === 'realm') return origin.realm ? lineKey(origin.realm) === lineKey(here.realm) : withinReach('regional', origin, here) || withinReach('local', origin, here);
    return true;
}

/** The name news gives its place: a hidden or secret place the atlas does not show yet (undiscovered) is named by its region. */
export function shownPlace(origin, tools, written) {
    if (!origin?.hidden) return written;
    const shown = tryQuery(queryOf(tools), 'atlas.places', {}, []);
    const found = (Array.isArray(shown) ? shown : []).some(place => lineKey(place?.name) === lineKey(origin.name));
    return found ? written : origin.regionName || origin.region || written;
}
