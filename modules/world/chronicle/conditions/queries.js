// The queries of the world conditions (active ones only). Behind the feature `story-director.world-events`: null while it is off.

import { setup } from '../queries-parts/env.js';
import { toolsQuery } from '../queries-parts/shared-ask.js';
import { isInt } from '../domain-parts/shared-basics.js';
import { declaredConditions } from './declared.js';
import { WORLD_EVENTS_FEATURE } from './feature.js';

const tagged = fn => Object.assign((state, args, tools) => fn(state, args ?? {}, tools), { feature: WORLD_EVENTS_FEATURE });

export const conditionQueries = {
    /** The active conditions, optionally for one `ref`, `scope` or `name`: `[{ key, name, scope, ref, since, fadesAt, why, by, rev }]` in key order. One past its end and not yet settled is not active. */
    'chronicle.conditions': tagged((state, { ref = null, scope = null, name = null }, tools) => {
        const env = setup(state, tools);
        const lower = text => String(text).toLowerCase();
        return Object.entries(env.chronicle.conditions ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, entry]) => ({ key, ...entry }))
            .filter(entry => !(isInt(env.now) && isInt(entry.fadesAt) && entry.fadesAt <= env.now))
            .filter(entry => (ref === null || lower(entry.ref) === lower(ref)) && (scope === null || entry.scope === scope) && (name === null || entry.name === name));
    }),
    /** The pack's declared list: `[{ name, scope, fades, means }]`. */
    'chronicle.conditionNames': tagged((_state, _args, tools) => declaredConditions(toolsQuery(tools))),
};
