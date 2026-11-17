// World events, the daily step on the host: the world the step reads, from the enabled packs (`packs.content`). Spec events are
// `content.worldEvents` (spec v0.12); spec-shaped entries of `content.events` (they have ends_when and no `when`) are read too,
// so a pack written to v0.10 is not lost. A kind the packs do not carry is empty; `placeKinds` / `routeKinds` merge. Pure.

import { ask } from '../queries-parts/shared-ask.js';

const rows = (query, kind) => { const out = ask(query, 'packs.content', { kind }); return Array.isArray(out) ? out : []; };
const merged = list => Object.assign({}, ...list.filter(item => item && typeof item === 'object' && !Array.isArray(item)));
const specShaped = event => event && typeof event === 'object' && event.when === undefined && event.ends_when !== undefined;

// Tests only: the install check refuses the spec's kinds until the pack-format job lands (night/WEINT.REPORT.md item 1), so a
// host test hands the world in here. Nothing in the suite sets it.
let override = null;

/** Tests only: the world is `fn(world read from the packs)` until the returned function is called. */
export function overrideWorld(fn) {
    override = typeof fn === 'function' ? fn : null;
    return () => { override = null; };
}

/** `readWorld(query)` → `{ places, routes, realms, placeKinds, routeKinds, conditions, events, templates, powers, scores, cast }`. */
export function readWorld(query) {
    const events = [...rows(query, 'worldEvents'), ...rows(query, 'events').filter(specShaped)];
    const world = {
        places: rows(query, 'places'), routes: rows(query, 'routes'), realms: rows(query, 'realms'),
        placeKinds: merged(rows(query, 'placeKinds')), routeKinds: merged(rows(query, 'routeKinds')),
        conditions: rows(query, 'conditions'), events, templates: rows(query, 'templates'),
        powers: rows(query, 'powers'), scores: rows(query, 'scores'), cast: rows(query, 'cast'),
    };
    return override ? override(world) : world;
}
