// Story Director v2, world: what the world's conditions do to a route's courier time (spec §2 condition effects and placeStatus):
// a condition held on the route, or holding at one of its ends (there, or broader: its region or realm), with `routes: "blocked"`
// or `"×0 speed"` blocks it; `"×0.5 speed"` doubles its time; a placeStatus condition at an end (fallen, evacuated) with no route
// effect of its own doubles it. Every multiplier that applies multiplies together, each condition once. Pure.

import { holdingAt } from '../chronicle/conditions/hold-at.js';

const low = text => String(text ?? '').trim().toLowerCase();

/** The time multiplier of a `routes` effect: "blocked" or "×0 speed" → Infinity, "×N speed" → 1/N; null when it says nothing. */
export function routeEffect(text) {
    const raw = low(text);
    if (!raw) return null;
    if (raw === 'blocked') return Infinity;
    const speed = /^[×x*]\s*(\d+(?:\.\d+)?)\s*speed$/.exec(raw);
    if (!speed) return null;
    const value = Number(speed[1]);
    return value > 0 ? 1 / value : Infinity;
}

/**
 * `factorOf(route name)` for the courier: `table` the stored conditions, `declared` the pack's list (`effects`, `placeStatus`),
 * `geo` the packs' map, `masks` the daily step's local clears, `now` the story minute.
 */
export function routeFactors({ table, declared, geo, masks = {}, now = null }) {
    const byName = new Map((Array.isArray(declared) ? declared : []).map(entry => [entry.name, entry]));
    return name => {
        const route = geo.routes.get(low(name));
        if (!route) return 1;
        const seen = new Map();
        for (const at of [route.name, route.from, route.to]) {
            for (const entry of holdingAt(table, { geo, at, now, masks })) {
                const own = byName.get(entry.name);
                const effect = routeEffect(own?.effects?.routes);
                const end = at !== route.name;
                if (effect !== null) seen.set(entry.key, effect);
                else if (end && own?.placeStatus === true && entry.scope === 'place') seen.set(entry.key, 2);
            }
        }
        return [...seen.values()].reduce((product, value) => product * value, 1);
    };
}
