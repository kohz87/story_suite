// The story's room for blocks and which extra blocks (rules, foes) Create adds beside a character.

import { DM_LIMITS } from '../../../data-modules/schema.js';
import { activeDefinition } from '../../../data-modules/adapters.js';
import { isRecord } from './shared-helpers.js';

// How many blocks the story has: its own (chat) blocks, which the story limit counts, and every active block, which the pin limit counts.
function blockCounts(state) {
    const domain = state?.domains?.dataModules;
    const active = isRecord(domain?.active) ? Object.values(domain.active) : [];
    return { own: active.filter(entry => domain.pins?.[entry.hash]?.packId === 'chat').length, all: active.length };
}

/** Whether two more blocks fit in the story (the chat holds at most `DM_LIMITS.definitions` of its own blocks). */
export function hasRoom(state, room = DM_LIMITS) {
    const { own, all } = blockCounts(state);
    return own + 2 <= room.definitions && all + 2 <= room.pins;
}

/** The chat blocks the RPG's fights need besides the characters, in the order Create adds them. */
export const RPG_EXTRAS = Object.freeze(['rules', 'foes']);

/** Which of the Combat rules (role rules) and Foes (role foes) blocks the story does not have yet, in `RPG_EXTRAS` order. `roleOf(definition)` is what a block is read as. */
export function missingBlocks(state, { roleOf = definition => definition?.role } = {}) {
    const domain = state?.domains?.dataModules;
    const roles = new Set(Object.keys(isRecord(domain?.active) ? domain.active : {}).map(id => {
        const definition = activeDefinition(state, id);
        return definition ? roleOf(definition) : null;
    }));
    return RPG_EXTRAS.filter(role => !roles.has(role));
}

/**
 * Which missing blocks fit beside the two a character is made of: `{ add: [roles that fit], skipped: [{ role, why: 'room' | 'actions' }] }`.
 * They go in the order of `RPG_EXTRAS`, so when only one fits it is the Combat rules. `free` is the block actions the reply has left; the
 * character and its skills take two of them.
 */
export function extrasPlan(state, { roleOf, free = Infinity } = {}) {
    const { own, all } = blockCounts(state);
    const space = Math.min(DM_LIMITS.definitions - own, DM_LIMITS.pins - all) - 2;
    const actions = free - 2;
    const add = [], skipped = [];
    for (const role of missingBlocks(state, { roleOf })) {
        if (add.length < space && add.length < actions) add.push(role);
        else skipped.push({ role, why: add.length >= space ? 'room' : 'actions' });
    }
    return { add, skipped };
}
