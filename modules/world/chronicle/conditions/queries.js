// The queries of the world conditions (active ones only). Behind the feature `story-director.world-events`: null while it is off.

import { setup } from '../queries-parts/env.js';
import { toolsQuery } from '../queries-parts/shared-ask.js';
import { isInt } from '../domain-parts/shared-basics.js';
import { declaredConditions } from './declared.js';
import { holdingAt } from './hold-at.js';
import { hostGeo } from './known-refs.js';
import { slotValue } from '../../../rpg/slot.js';
import { WORLD_EVENTS_FEATURE } from './feature.js';

const tagged = fn => Object.assign((state, args, tools) => fn(state, args ?? {}, tools), { feature: WORLD_EVENTS_FEATURE });

export const conditionQueries = {
    /**
     * The active conditions, optionally for one `ref`, `scope` or `name`: `[{ key, name, scope, ref, since, fadesAt, why, by, rev }]` in key order.
     * One past its end and not yet settled is not active, unless an Active event holds it (`holds`). With `at` (a place, region, realm
     * or route): the ones that hold there through the scope hierarchy (spec §2), narrowest first, each with its `level`; `region` names
     * the region of a place only the atlas knows.
     */
    'chronicle.conditions': tagged((state, { ref = null, scope = null, name = null, at = null, region = null }, tools) => {
        const env = setup(state, tools);
        if (typeof at === 'string' && at.trim()) {
            const masks = slotValue(env.chronicle.daily)?.masks ?? {};
            return holdingAt(env.chronicle.conditions, { geo: hostGeo(toolsQuery(tools)), at: at.trim(), now: env.now, masks, levels: [at.trim(), ...(typeof region === 'string' && region.trim() ? [region.trim()] : [])] })
                .filter(entry => (scope === null || entry.scope === scope) && (name === null || entry.name === name));
        }
        const lower = text => String(text).toLowerCase();
        return Object.entries(env.chronicle.conditions ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, entry]) => ({ key, ...entry }))
            .filter(entry => entry.holds?.length || !(isInt(env.now) && isInt(entry.fadesAt) && entry.fadesAt <= env.now))
            .filter(entry => (ref === null || lower(entry.ref) === lower(ref)) && (scope === null || entry.scope === scope) && (name === null || entry.name === name));
    }),
    /** The regions' display names (`content.regions`, by id, name or alias, lower case) → name; `{}` when the packs give none. The World tab shows names, never ids. Not behind the switch: names are display only, and a pack with no `content.regions` reads as before. */
    'chronicle.regionNames': (_state, _args, tools) => Object.fromEntries(hostGeo(toolsQuery(tools)).regionNames ?? []),
    /** The pack's declared list: `[{ name, scope, fades, means }]`. */
    'chronicle.conditionNames': tagged((_state, _args, tools) => declaredConditions(toolsQuery(tools))),
};
