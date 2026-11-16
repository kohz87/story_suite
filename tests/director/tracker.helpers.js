import assert from 'node:assert/strict';

import { parseChanges } from '../../modules/world/changes.js';
import { emptyTracker, replay } from '../../modules/time/tracker/tracker.js';

export function ops(text) {
    const parsed = parseChanges(text);
    assert.deepEqual(parsed.errors, [], text);
    return parsed.ops;
}

export function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
}

export const START = ops([
    '+ agenda Senior Listener Geva — now: District Bailiff Court | then: argues with magistrates | on: Haywane 12, 05:45 pm | people: Kade, Al',
    '+ clock Hollin\'s Reach graves — washed graves left uncompleted → the first of the dead rise | due: Goldwane 28 | shown: none',
    '+ event Canal Street Granary Fires — Lower city ablaze | then: citywide night curfew declared | on: Haywane 12, 06:00 pm',
    '+ hook River stranger — who pulled Ren from the sump',
    '+ agenda Hall-Warden Kell — now: the gatehouse',
].join('\n'));

export const BLUEWATCH = ops([
    '+ hook Footing at Bluewatch — the party needs a foothold in the village',
    '+ agenda Senior Listener Geva — now: Court',
    '+ event The Fall of the Weir — the old weir gave way',
].join('\n'));

export function after(lines) {
    return replay([
        { message: 0, time: 0, ops: BLUEWATCH },
        { message: 1, time: 10, ops: ops(lines) },
    ]);
}

export const WOLF_HUNT = '+ quest Wolf Hunt — Kill ridge wolves threatening the sheep fold | giver: Danique | reward: 4 silver';
