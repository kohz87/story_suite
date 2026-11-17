// World events for the arc planner (switch story-director.world-events; spec §9 The arc director and world events, ruling 9). The
// query `chronicle.world.brief` gives the planner's brief what the engine knows: each Active event mirrored as a thread of kind
// `world-event` (seam audit E32: not the tracker's own `event` kind) with now = its summary (and outcome when chosen), then = "outcome
// decided by the world"; "Still to come", the pending backbone stages (chain stages and set-in-motion events not yet fired), titles
// only; and the active conditions in the party's realm with what they mean. The mirror is read from the step's state each time it is
// asked (nothing is stored), so it ends when the event ends. Null while the switch is off.

import { setup } from '../queries-parts/env.js';
import { toolsQuery } from '../queries-parts/shared-ask.js';
import { scenePlaceOf } from '../pick.js';
import { slotValue } from '../../../rpg/slot.js';
import { WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { readDefs } from '../../daily/defs.js';
import { buildGeo, resolveRef } from '../../daily/geo.js';
import { realmsOf } from '../../daily/geo-scope.js';
import { entryActive } from '../../daily/holds-read.js';
import { readWorld } from './read-world.js';

export const WORLD_EVENT_THEN = 'outcome decided by the world';
const MAX = 8;
const DONE = new Set(['active', 'ended', 'lapsed', 'replaced']);
const fill = (text, outcome, bind) => String(text ?? '').replace(/\{outcome\}/g, outcome ?? '').replace(/\{place\}/g, bind?.place ?? '').replace(/\{region\}/g, bind?.region ?? bind?.place ?? '').replace(/\{realm\}/g, bind?.realm ?? '').replace(/\s+/g, ' ').trim();

/** `{ threads: [{ kind, key, now, then }], toCome: [title], conditions: [text] }` from the step's state, the conditions and the world. */
export function arcBrief({ daily = null, table = {}, world = {}, place = '', minute = null } = {}) {
    const { events } = readDefs(world);
    const rows = daily?.events ?? {};
    const threads = events.filter(def => rows[def.id]?.state === 'active').slice(0, MAX).map(def => {
        const row = rows[def.id];
        const summary = fill(def.summary, row.outcome, row.bind);
        return { kind: 'world-event', key: def.title, now: row.outcome ? `${summary} (outcome: ${row.outcome})` : summary, then: WORLD_EVENT_THEN };
    });
    const toCome = events.filter(def => (def.kind === 'chain-stage' || def.certainty === 'set-in-motion') && !DONE.has(rows[def.id]?.state) && rows[def.id]?.fired === undefined).slice(0, MAX).map(def => def.title);
    const geo = buildGeo(world);
    const found = place ? resolveRef(geo, place) : null;
    const realm = found ? realmsOf(geo, [found.name])[0] ?? null : null;
    const means = new Map((Array.isArray(world.conditions) ? world.conditions : []).map(row => [row?.name, row?.means]));
    const conditions = realm === null ? [] : Object.keys(table ?? {}).sort()
        .filter(key => entryActive(table[key], Number.isInteger(minute) ? minute : 0) && realmsOf(geo, [table[key].ref]).includes(realm))
        .slice(0, MAX).map(key => `${key}${means.get(table[key].name) ? `: ${means.get(table[key].name)}` : ''}`);
    return { threads, toCome, conditions };
}

/** The query (feature-tagged: null while the switch is off). */
export const worldBriefQuery = Object.assign((state, _args, tools) => {
    const env = setup(state, tools);
    const query = toolsQuery(tools);
    return arcBrief({ daily: slotValue(env.chronicle?.daily), table: env.chronicle?.conditions ?? {}, world: readWorld(query), place: scenePlaceOf(query, state) ?? '', minute: env.now });
}, { feature: WORLD_EVENTS_FEATURE });
