// Story Director v2, world: where a place is on the map for news (spec §4 reach, §1 Place discovery). A place of the packs' map has
// its region, its realm and its city (a district's); a place only the atlas knows has the atlas's region. The Wilds are one realm
// for the caps only (spec §1): for news a wild place has no realm, so wild regions are not each other's realm. News stops at its
// `reach` (local: the same place or city; regional: the same region; realm: the same realm, or the same region in the Wilds; world,
// or none given: everywhere). News from a hidden or secret place the party has not reached names its region instead. A region's own name
// or id is a place too (the region alone, `area`). A scene's place no pack names is heard at as the pack place it stands for (`hearAt`,
// the atlas's `atlas.anchor`: its town, its parent, the pack place last visited in its region, else the region; LAB2-3). Pure.

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
    if (!atlas) return regionInfo(geo, name);
    const region = text(atlas.region);
    return { name: text(atlas.name) || name, group: text(atlas.name) || name, region, regionName: geo.regionNames?.get(low(region)) ?? region, realm: region ? geo.regionRealm.get(low(region)) ?? '' : '', hidden: false };
}

// A region named by its id, name or alias: `{ name, group, region, regionName, realm, hidden, area: true }`, or null.
function regionInfo(geo, name) {
    const key = low(name);
    const shown = geo.regionNames?.get(key);
    const id = geo.regions?.get(key) ?? (shown ? [...(geo.regions?.values() ?? [])].find(region => geo.regionNames.get(low(region)) === shown) : null);
    if (!id) return null;
    const realm = geo.regionRealm.get(low(id)) ?? '';
    return { name: shown ?? id, group: id, region: id, regionName: shown ?? id, realm: realm === WILDS ? '' : realm, hidden: false, area: true };
}

/** The place news is heard at for the place name `name` (a scene's): the pack place it stands for (`atlas.anchor`), else its region, else `name`. */
export function hearAt(tools, name) {
    const anchor = tryQuery(queryOf(tools), 'atlas.anchor', { name }, null);
    return text(anchor?.name) || text(anchor?.region) || text(name);
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
