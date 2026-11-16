// The queries `mounts.list` and `mounts.pace`.

import { MOUNTS_FEATURE } from './feature.js';
import { mountRows, mountsPace } from './rows.js';

/** The queries: `mounts.list` → rows, `mounts.pace` → the party's pace or null. `riders(state)` says how many have to be carried. */
export function createMountsQueries({ riders = () => 1 } = {}) {
    return {
        'mounts.list': Object.assign(state => mountRows(state), { feature: MOUNTS_FEATURE }),
        'mounts.pace': Object.assign(state => {
            let people = 1;
            try { people = riders(state); } catch { people = 1; }
            return mountsPace(state, people);
        }, { feature: MOUNTS_FEATURE }),
    };
}
