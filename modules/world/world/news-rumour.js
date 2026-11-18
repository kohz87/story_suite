// Story Director v2, world: where news is heard as fact and where only as rumour (spec §4, ruling 53). Reach sets how far CONFIRMED news
// travels; one step further it still travels, as rumour, by courier time: local → fact at the place's town, rumour in its region;
// regional → fact in its region, rumour in the rest of its realm and in the regions a route joins to it; realm → fact in the realm,
// rumour in the realms a route joins to it; world → fact everywhere. A minor happening is fact only in its own region (rumour in
// the rest of its reach and the step beyond). Further than that it is not heard at all. Pure.

import { lineKey } from '../changes.js';
import { withinReach } from './news-reach.js';

const same = (a, b) => Boolean(a) && Boolean(b) && lineKey(a) === lineKey(b);

// The pairs of regions and of realms the routes join (a route's two ends on the packs' map), worked out once per map.
const joined = new WeakMap();
function joins(geo) {
    if (!joined.has(geo)) {
        const regions = new Set();
        const realms = new Set();
        for (const route of new Set(geo.routes.values())) {
            const [a, b] = [geo.byName.get(lineKey(route.from)), geo.byName.get(lineKey(route.to))];
            if (!a || !b) continue;
            if (a.region && b.region && !same(a.region, b.region)) regions.add(`${lineKey(a.region)}|${lineKey(b.region)}`).add(`${lineKey(b.region)}|${lineKey(a.region)}`);
            const [ra, rb] = [geo.regionRealm.get(lineKey(a.region)), geo.regionRealm.get(lineKey(b.region))];
            if (ra && rb && !same(ra, rb)) realms.add(`${lineKey(ra)}|${lineKey(rb)}`).add(`${lineKey(rb)}|${lineKey(ra)}`);
        }
        joined.set(geo, { regions, realms });
    }
    return joined.get(geo);
}
const meets = (set, a, b) => Boolean(a) && Boolean(b) && set.has(`${lineKey(a)}|${lineKey(b)}`);

// The one step beyond a reach: rumour is heard here (place infos, both known).
function rumourStep(geo, reach, origin, here) {
    if (reach === 'local') return same(origin.region, here.region);
    const links = joins(geo);
    if (reach === 'regional') return same(origin.realm, here.realm) || meets(links.regions, origin.region, here.region);
    if (reach === 'realm') return origin.realm ? meets(links.realms, origin.realm, here.realm) : meets(links.regions, origin.region, here.region);
    return false;
}

/** `'fact'`, `'rumour'` or `null` (not heard) for news of `reach` from `origin` at `here` (place infos; `minor`: a minor happening). An unknown place is not held back. */
export function reachTag(geo, reach, origin, here, minor = false) {
    if (!withinReach(reach, origin, here)) return rumourStep(geo, reach, origin, here) ? 'rumour' : null;
    if (minor && origin.region && here.region && !same(origin.region, here.region)) return 'rumour';
    return 'fact';
}

/** The ids of the minor happenings of a world: its minor events, and every template that is not written major. */
export function minorIds(world) {
    const ids = new Set();
    for (const event of Array.isArray(world.events) ? world.events : []) if (event?.severity === 'minor' && typeof event.id === 'string') ids.add(event.id);
    for (const template of Array.isArray(world.templates) ? world.templates : []) if (template?.severity !== 'major' && typeof template?.template === 'string') ids.add(`template.${template.template}`);
    return ids;
}
