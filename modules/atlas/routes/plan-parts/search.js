// Finds shortest paths and plans full multi-hop routes with rest days and arrivals.

import { addDays, positive, tidy, toAbs } from '../util.js';
import { DEFAULT_RULES, SELF_MODES, indexOf, normalizeMode, resolvePlace } from '../pack.js';
import { paceFor } from './pace.js';
import { boardDays, overnights, restDaysFor } from './days.js';
import { hopDays, hopMode } from './hop.js';

// Per neighbour, the edge this mode can use with the fewest days (shorter km on a tie).
function usableEdges(pack, place, mode, accept, transfer = false) {
    const best = new Map();
    for (const edge of indexOf(pack).adjacency.get(place) ?? []) {
        if (accept && !accept(edge)) continue;
        const by = hopMode(pack, edge, mode, transfer);
        if (!by) continue;
        const next = edge.a === place ? edge.b : edge.a;
        // A transfer weighs three times its time, so a train trip takes the train where there is one.
        const days = hopDays(pack, edge, by) * (by === mode ? 1 : 3);
        const current = best.get(next);
        const own = current && current.mode === mode;
        if (own && by !== mode) continue;
        if (!current || (by === mode && !own) || days < current.days || (days === current.days && edge.km < current.edge.km)) {
            best.set(next, { edge, days, mode: by });
        }
    }
    return best;
}

// Dijkstra by km; in a modern pack by time, as a motorway's detour or a flight is quicker.
// `accept` narrows the edges (validateLeg uses it to stay on one road code); `transfer` lets
// public transport reach its stations (planRoute and shortestPath only).
export function search(pack, start, goal, mode, accept = null, transfer = false) {
    const byTime = pack.era === 'modern';
    if (start === goal) return { from: start, to: goal, km: 0, hops: [] };
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const done = new Set();
    const queue = [start];
    while (queue.length) {
        let pick = 0;
        for (let i = 1; i < queue.length; i++) {
            if (dist.get(queue[i]) < dist.get(queue[pick])) pick = i;
        }
        const place = queue.splice(pick, 1)[0];
        if (done.has(place)) continue;
        done.add(place);
        if (place === goal) break;
        for (const [next, { edge, days, mode: by }] of usableEdges(pack, place, mode, accept, transfer)) {
            const cost = dist.get(place) + (byTime ? days : edge.km);
            if (cost < (dist.get(next) ?? Infinity)) {
                dist.set(next, cost);
                prev.set(next, { place, edge, mode: by });
                queue.push(next);
            }
        }
    }
    if (!prev.has(goal)) return null;
    const hops = [];
    for (let place = goal; place !== start; place = prev.get(place).place) {
        const { place: from, edge, mode: by } = prev.get(place);
        const hop = { from, to: place, km: edge.km, code: edge.code, corridor: edge.corridor };
        if (by !== mode) hop.mode = by;
        hops.unshift(hop);
    }
    return { from: start, to: goal, km: tidy(hops.reduce((sum, hop) => sum + hop.km, 0)), hops };
}

// Public transport in a modern pack may take a short transfer to its station.
const transfersFor = (pack, mode) => pack?.era === 'modern' && !SELF_MODES.includes(mode);

export function shortestPath(pack, from, to, { mode = 'foot' } = {}) {
    const name = normalizeMode(mode, pack);
    const start = resolvePlace(pack, from);
    const goal = resolvePlace(pack, to);
    if (!name || !start || !goal) return null;
    return search(pack, start, goal, name, null, transfersFor(pack, name));
}

/**
 * The shortest route with days per hop (an explicit `rate` replaces the pack's pace on every
 * hop), rest days for the mode, and the arrival when `depart` is given (abs, or a date text
 * read with `calendar`).
 */
export function planRoute(pack, from, to, { mode = 'foot', rate = null, depart = null, calendar = null } = {}) {
    const name = normalizeMode(mode, pack);
    const route = shortestPath(pack, from, to, { mode: name });
    if (!route) return null;
    const explicit = positive(rate);
    const rules = pack.rules ?? DEFAULT_RULES;
    const hops = route.hops.map(hop => {
        const by = hop.mode ?? name;
        // An explicit rate is the trip's own mode's; a transfer goes at its pace.
        const hopRate = (by === name ? explicit : null) ?? paceFor(pack, hop.code, by, { corridor: hop.corridor }).rate;
        return { ...hop, rate: hopRate, days: hopDays(pack, hop, by, hopRate) };
    });
    const activeDays = tidy(hops.reduce((sum, hop) => sum + hop.days, 0));
    const restDays = restDaysFor(name, activeDays, rules);
    const boardHours = tidy(hops.reduce((sum, hop) => sum + (hop.mode ? 0 : boardDays(pack, hop.code)), 0) * 24);
    const days = tidy(activeDays + restDays);
    const start = toAbs(depart, calendar);
    return {
        ...route, mode: name, hops, activeDays, restDays, days,
        unit: rules.unit === 'hour' ? 'hour' : 'day', boardHours,
        stops: overnights(name, activeDays, rules),
        depart: start,
        arrive: start === null ? null : addDays(start, days, calendar),
    };
}
