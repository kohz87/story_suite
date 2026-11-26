// The party's regions, for world events' proximity terms: where the scene is, and the region of the holding's seat while it has one. Pure.

const text = value => (typeof value === 'string' ? value.trim() : '');
const same = (a, b) => text(a).toLowerCase() === text(b).toLowerCase();

/**
 * `partyRegions(query)` → region names or ids as stored, the scene's first, no repeats, no blanks (`query(name, args)` asks the engine;
 * a query that is not there answers nothing). The seat's region is the holding's own `region`, else the map's for the seat's name,
 * else the scene's when the scene is at the seat.
 */
export function partyRegions(query) {
    const ask = (name, args) => { try { return query(name, args) ?? null; } catch { return null; } };
    const scene = ask('scene.place', {});
    const holding = ask('dataModules.holding', {});
    const seat = text(holding?.seat);
    const seatRegion = seat ? text(holding.region) || text(ask('atlas.place', { name: seat })?.region) || (same(scene?.name, seat) ? text(scene.region) : '') : '';
    return [text(scene?.region), seatRegion].filter((region, at, all) => region && all.findIndex(other => same(other, region)) === at);
}
