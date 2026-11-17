// Story Director v2, atlas part: how long a courier takes between two places (pure).
//
// The shortest way over the route graph (Dijkstra), each route taking its own time when it gives
// hours (the pack's noted river or sea pace), else its km at the courier's km a day. A place with no
// road of its own goes by its town's, with the short fixed hop each side (travel.js `townOf`).
// Nothing is stored; the news arrival (world part, news.js) asks it as `atlas.courier`.

import { TOWN_HOP_DAYS, townOf } from './travel.js';

/** The courier's km a day when the reader's settings give none. */
export const COURIER_KM_PER_DAY = 60;

const tidy = value => Math.round(value * 1e6) / 1e6;

function edgeDays(route, kmPerDay) {
    if (typeof route.hours === 'number' && Number.isFinite(route.hours) && route.hours >= 0) return route.hours / 24;
    return typeof route.km === 'number' && Number.isFinite(route.km) && route.km > 0 ? route.km / kmPerDay : null;
}

/**
 * `{ days, km, hops }` for the courier from `from` to `to` (names or ids in `world`), or null: an unknown place, or no chain of
 * routes between them. `km` counts only the routes that give it. The same place is 0 days.
 */
export function courierDays(world, from, to, { kmPerDay = COURIER_KM_PER_DAY } = {}) {
    const speed = typeof kmPerDay === 'number' && Number.isFinite(kmPerDay) && kmPerDay > 0 ? kmPerDay : COURIER_KM_PER_DAY;
    const a = world?.find(from);
    const b = world?.find(to);
    if (!a || !b) return null;
    if (a.id === b.id) return { days: 0, km: 0, hops: 0 };
    const [up, down] = [townOf(world, a), townOf(world, b)];
    const [start, goal] = [up ?? a, down ?? b];
    const extra = (up ? TOWN_HOP_DAYS : 0) + (down ? TOWN_HOP_DAYS : 0);
    if (start.id === goal.id) return { days: tidy(extra), km: 0, hops: 0 };
    const edges = new Map();
    for (const route of world.routes) {
        const days = edgeDays(route, speed);
        if (days === null) continue;
        for (const [x, y] of [[route.from, route.to], [route.to, route.from]]) edges.set(x, [...(edges.get(x) ?? []), { to: y, days, km: route.km > 0 ? route.km : 0 }]);
    }
    const best = new Map([[start.id, { days: 0, km: 0, hops: 0 }]]);
    const open = new Set([start.id]);
    while (open.size) {
        // The nearest open place; ties by id, so the answer never depends on route order.
        const at = [...open].sort((x, y) => best.get(x).days - best.get(y).days || (x < y ? -1 : 1))[0];
        open.delete(at);
        if (at === goal.id) break;
        const here = best.get(at);
        for (const edge of edges.get(at) ?? []) {
            const days = tidy(here.days + edge.days);
            if (days < (best.get(edge.to)?.days ?? Infinity)) {
                best.set(edge.to, { days, km: tidy(here.km + edge.km), hops: here.hops + 1 });
                open.add(edge.to);
            }
        }
    }
    const found = best.get(goal.id);
    return found ? { days: tidy(found.days + extra), km: found.km, hops: found.hops } : null;
}
