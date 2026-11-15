// Plans a multi-leg trip along known atlas routes.

import { DEFAULT_RULES, MODERN_RULES, legDays, restDaysFor } from '../../../routes.js';
import { TOWN_HOP_DAYS, hopMode, townOf } from '../travel.js';
import { cleanWord } from '../domain.js';
import { MAX_LEGS } from '../trip-shape.js';
import { DAY, tidy } from './shared-constants.js';
import { modeWords } from './modes.js';

// A hop's pace: its kind's own for water and air; the trip's for land, and Story Block's mount pace (when it answered) for a ride.
function hopPace(kind, mode, { modern, pace }) {
    const by = hopMode(kind, mode, { modern });
    if (!by) return null;
    return pace && !modern && mode === 'ride' && by.mode === 'ride' ? pace : by.pace;
}

// One route as an edge for the planner: its km, and the days it takes (the route's own hours, else km at the pace).
function edgeOf(route, mode, options) {
    const pace = hopPace(route.kind, mode, options);
    if (!pace) return null;
    const hours = route.hours !== null && route.hours !== undefined ? route.hours : null;
    const km = route.km > 0 ? route.km : hours !== null ? Math.max(1, Math.round((hours / 24) * pace)) : null;
    if (km === null) return null;
    const days = hours !== null ? tidy(hours / 24) : legDays(km, pace, options.modern ? MODERN_RULES : DEFAULT_RULES);
    return days === null ? null : { km, days, pace, hours };
}

// The days for `km` of a road of `kind` (the part of a road still to go).
function partDays(route, km, mode, options) {
    const pace = hopPace(route.kind, mode, options);
    if (!pace) return null;
    return legDays(km, pace, options.modern ? MODERN_RULES : DEFAULT_RULES);
}

// The shortest way by km between two places along known routes: [{ route, from, to, edge }] or null (v1's travel.js order breaks ties).
function shortestKm(world, start, goal, mode, options) {
    if (start === goal) return [];
    const order = new Map(world.places.map((place, index) => [place.id, index]));
    const edges = new Map();
    for (const route of world.routes) {
        const edge = edgeOf(route, mode, options);
        if (!edge) continue;
        for (const [a, b] of [[route.from, route.to], [route.to, route.from]]) {
            if (!edges.has(a)) edges.set(a, []);
            edges.get(a).push({ from: a, to: b, route, edge });
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
        for (const hop of edges.get(here) ?? []) {
            const cost = dist.get(here) + hop.edge.km;
            if (cost < (dist.get(hop.to) ?? Infinity)) {
                dist.set(hop.to, cost);
                prev.set(hop.to, hop);
                queue.push(hop.to);
            }
        }
    }
    if (!prev.has(goal)) return null;
    const hops = [];
    for (let at = goal; at !== start; at = prev.get(at).from) hops.unshift(prev.get(at));
    return hops;
}

/**
 * Plans a trip. `from`: `{ node }` (a place id) or `{ road: { from, to, km, kind, along } }` ({{user}} is `along` km down the road
 * between two places, `from` and `to` as names, in the direction they are going: `along` counted from `from`); `via`: place ids to
 * pass through, in order; `to`: a place id; `rest`: count rest days as the estimate does (travel.js `travelTime`: `restDaysFor` over the trip's travelling
 * days, each leg taking the rests that fall within it, so the total is the estimate's), else the legs are travel days only (a trip from before rest days counted). `world` is the joined world (world.js). Starting on a road the party goes on to the road's end or back to its start,
 * whichever gets there with the fewer km ("no turnings mid-leg"). Returns `{ legs, km, days }` (legs with `start` and `arrive`
 * in story minutes from `at`), or `{ error }` naming the gap (the two places no known route joins).
 */
export function planTrip(world, { from, via = [], to, mode, pace = null, modern = false, at, rest = false }) {
    const options = { modern, pace };
    const name = id => world.find(id)?.name ?? id;
    const chain = (start, stops) => {
        const hops = [];
        let here = start;
        for (const stop of stops) {
            // A place with no road of its own goes by its town's roads, with a short fixed hop each side (travel.js townOf).
            const [out, into] = [townOf(world, world.find(here)), townOf(world, world.find(stop))];
            const way = shortestKm(world, out?.id ?? here, into?.id ?? stop, mode, options);
            if (!way) return { error: `No known route from ${name(here)} to ${name(stop)}.` };
            const town = (from, to) => ({ from, to, route: { kind: '' }, edge: { km: 1, days: TOWN_HOP_DAYS, town: true } });
            hops.push(...(out ? [town(here, out.id)] : []), ...way, ...(into ? [town(into.id, stop)] : []));
            here = stop;
        }
        return { hops };
    };
    const townLegs = new Set();
    const legOf = (hop, extra = {}) => {
        const leg = {
            from: name(hop.from), to: name(hop.to), km: Math.max(1, Math.round(hop.edge.km)), kind: cleanWord(hop.route.kind, { lower: true }),
            days: hop.edge.days, ...extra,
        };
        if (hop.edge.town) townLegs.add(leg);
        return leg;
    };
    const stops = [...via, to];
    let first = null;
    let hops = null;
    if (from.node !== undefined) {
        const planned = chain(from.node, stops);
        if (planned.error) return planned;
        hops = planned.hops;
    } else {
        const { road } = from;
        const [a, b] = [world.find(road.from), world.find(road.to)];
        if (!a || !b) return { error: `The road between ${road.from} and ${road.to} is no longer on the map.` };
        const total = (list, edgeKm) => list.reduce((sum, hop) => sum + hop.edge.km, edgeKm);
        const choices = [
            { forward: true, start: b.id, remaining: road.km - road.along },
            { forward: false, start: a.id, remaining: road.along },
        ].map(choice => ({ ...choice, ...chain(choice.start, stops) }));
        const usable = choices.filter(choice => !choice.error);
        if (!usable.length) return { error: `You are on the road between ${a.name} and ${b.name}, and it only goes on to ${b.name} or back to ${a.name}. ${choices[0].error} ${choices[1].error}` };
        usable.sort((a2, b2) => total(a2.hops, a2.remaining) - total(b2.hops, b2.remaining) || Number(b2.forward) - Number(a2.forward));
        const pick = usable[0];
        const days = partDays({ kind: road.kind }, pick.remaining, mode, options);
        if (days === null) return { error: `The road between ${a.name} and ${b.name} cannot be travelled ${modeWords(mode)}.` };
        // The first leg runs the road in the direction of travel, `skip` km of it already behind.
        first = pick.forward
            ? { from: a.name, to: b.name, km: road.km, kind: cleanWord(road.kind, { lower: true }), days, skip: road.along }
            : { from: b.name, to: a.name, km: road.km, kind: cleanWord(road.kind, { lower: true }), days, skip: road.km - road.along };
        hops = pick.hops;
    }
    const legs = [...(first ? [first] : []), ...hops.map(hop => legOf(hop))];
    if (!legs.length) return { error: 'You are already there.' };
    if (legs.length > MAX_LEGS) return { error: `That is ${legs.length} stages: ${MAX_LEGS} is as many as a trip keeps. Go by stages.` };
    if (rest) {
        // The short town hops add no rest on a map told in days, as the estimate leaves them out; on a modern map they count.
        const rules = modern ? MODERN_RULES : DEFAULT_RULES;
        let active = 0;
        let rested = 0;
        for (const leg of legs) {
            if (modern || !townLegs.has(leg)) active = tidy(active + leg.days);
            const total = restDaysFor(mode, active, rules);
            leg.days = tidy(leg.days + (total - rested));
            rested = total;
        }
    }
    let clock = at;
    for (const leg of legs) {
        leg.start = clock;
        clock += Math.max(1, Math.round(leg.days * DAY));
        leg.arrive = clock;
    }
    return { legs, km: legs.reduce((sum, leg) => sum + leg.km - (leg.skip ?? 0), 0), days: tidy((clock - at) / DAY) };
}
