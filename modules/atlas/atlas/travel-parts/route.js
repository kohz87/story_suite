// Computing shortest-path and map-estimated travel times between places.

import { DEFAULT_MAP, estimateTrip, mapSettings } from '../../places.js';
import { parentOf } from '../parent.js';
import { DEFAULT_RULES, MODERN_RULES, durationText, restDaysFor } from '../../routes.js';
import { defaultMode, routeDays } from './modes.js';
import { tidy } from './shared-math.js';

/** What a hop between a place and the town it stands in takes: half an hour (a fixed short walk, whatever the offset on the map). */
export const TOWN_HOP_HOURS = 0.5;
export const TOWN_HOP_DAYS = TOWN_HOP_HOURS / 24;

/**
 * The town a place with no road of its own stands in (its saved `parent`, else the town its "X / Y" or "X (Y)" name says: a pack's
 * start place "Bluewatch Village / Guild Office" has no saved parent), or null: its trips go through the town's roads.
 */
export function townOf(world, place) {
    if (!place || world.routes.some(route => route.from === place.id || route.to === place.id)) return null;
    const up = place.parent ? world.find(place.parent) : parentOf(place.name, world)?.parent ?? null;
    return !up || up.id === place.id ? null : up;
}

function shortest(world, start, goal, mode, modern) {
    const order = new Map(world.places.map((place, index) => [place.id, index]));
    const edges = new Map();
    for (const route of world.routes) {
        const days = routeDays(route, mode, { modern });
        if (days === null) continue;
        for (const [a, b] of [[route.from, route.to], [route.to, route.from]]) {
            if (!edges.has(a)) edges.set(a, []);
            edges.get(a).push({ to: b, days, route });
        }
    }
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const done = new Set();
    const queue = [start];
    while (queue.length) {
        let pick = 0;
        for (let i = 1; i < queue.length; i += 1) {
            const a = dist.get(queue[i]);
            const b = dist.get(queue[pick]);
            if (a < b || (a === b && (order.get(queue[i]) ?? 0) < (order.get(queue[pick]) ?? 0))) pick = i;
        }
        const here = queue.splice(pick, 1)[0];
        if (done.has(here)) continue;
        done.add(here);
        if (here === goal) break;
        for (const edge of edges.get(here) ?? []) {
            const cost = tidy(dist.get(here) + edge.days);
            if (cost < (dist.get(edge.to) ?? Infinity)) {
                dist.set(edge.to, cost);
                prev.set(edge.to, { from: here, edge });
                queue.push(edge.to);
            }
        }
    }
    if (!prev.has(goal)) return null;
    const hops = [];
    for (let at = goal; at !== start; at = prev.get(at).from) hops.unshift(prev.get(at).edge);
    return hops;
}

/**
 * The trip from `from` to `to` (ids, node ids or names in `world`):
 * `{ from, to, days, activeDays, restDays, unit: 'day' | 'hour', mode, source: 'routes' | 'map', hops, km, text }`
 * or null when nothing says how far it is. `map` is v1's map settings (era, km per unit, road
 * factor); `mode` v1's (default on foot, a car on a modern map).
 */
export function travelTime(world, from, to, { map = DEFAULT_MAP, mode = null } = {}) {
    const a = world?.find(from);
    const b = world?.find(to);
    if (!a || !b || a.id === b.id) return null;
    const settings = mapSettings(map);
    const modern = settings.era === 'modern';
    const trip = mode ?? defaultMode(settings);
    const rules = modern ? MODERN_RULES : DEFAULT_RULES;
    // A place with no road of its own goes by its town's, plus a short fixed hop each side; two places in one town: the hop alone.
    const [up, down] = [townOf(world, a), townOf(world, b)];
    const [start, goal] = [up ?? a, down ?? b];
    const extra = tidy((up ? TOWN_HOP_DAYS : 0) + (down ? TOWN_HOP_DAYS : 0));
    const hops = start.id === goal.id ? (extra ? [] : null) : shortest(world, start.id, goal.id, trip, modern);
    if (hops) {
        const timed = hops.every(hop => hop.route.hours !== null && hop.route.hours !== undefined);
        const sum = add => tidy(hops.reduce((total, hop) => total + hop.days, add));
        const unitOf = total => (modern || (timed && total < 1) ? 'hour' : 'day');
        // A trip told in days leaves the half-hour hops out (they add no rest day and no fraction of a day); one told in hours keeps them.
        const unit = unitOf(tidy(sum(extra) + restDaysFor(trip, sum(extra), rules)));
        const activeDays = sum(unit === 'day' ? 0 : extra);
        const restDays = restDaysFor(trip, activeDays, rules);
        const days = tidy(activeDays + restDays);
        const km = hops.length && hops.every(hop => hop.route.km > 0) ? tidy(hops.reduce((sum, hop) => sum + hop.route.km, 0)) : null;
        return {
            from: a.id, to: b.id, days, activeDays, restDays, unit, mode: trip, source: 'routes',
            hops: hops.map(hop => hop.route.id), km, text: durationText(days, unit),
        };
    }
    if (a.x === null || b.x === null) return null;
    const estimate = estimateTrip({ name: a.name, coords: { x: a.x, y: a.y } }, { name: b.name, coords: { x: b.x, y: b.y } }, { map: settings, mode: trip });
    if (!estimate) return null;
    return {
        from: a.id, to: b.id, days: estimate.days, activeDays: tidy(estimate.days - estimate.restDays), restDays: estimate.restDays,
        unit: estimate.unit, mode: estimate.mode, source: 'map', hops: [], km: tidy(estimate.roadKm), text: `≈ ${durationText(estimate.days, estimate.unit)}`,
    };
}
