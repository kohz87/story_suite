// What the carried gear adds: the carry answer, the carry bonuses by stack and a def's own capacity.

import { isPlainObject } from '../../scene/domains/common.js';
import { isCount, CARRY_MAX } from '../state.js';
import { asker } from './shared-ask.js';

// What answers `items.carry`: a carry module's own answer, else (while `story-block.gear` is on) Story Block's rules, asked as
// `gear.carry` (a query of the name `items.carry` would clash with a carry module's). Null when nothing answers: no limit.
export function carryAnswer(ask, args, own = true) {
    for (const name of own ? ['items.carry', 'gear.carry'] : ['items.carry']) {
        let said = null;
        try { said = ask(name, args); } catch { said = null; }
        if (isPlainObject(said)) return said;
    }
    return null;
}

/** The carry capacity each stack adds, by stack id, as the carry module reports it (`items.carry` → `bonuses`), or null. */
export function carryBonuses(tools) {
    const view = typeof tools?.query === 'function' ? carryAnswer(asker(tools), {}) : null;
    if (!isPlainObject(view) || !Array.isArray(view.bonuses)) return null;
    const out = {};
    for (const entry of view.bonuses) if (typeof entry?.stack === 'string' && isCount(entry.carry, 1)) out[entry.stack] = Math.min(CARRY_MAX, entry.carry);
    return out;
}

/** The capacity a def adds to what its owner carries (a pack item's `carry`), or null. */
export const defCarry = def => (isCount(def?.carry, 1) && def.carry <= CARRY_MAX ? def.carry : null);
