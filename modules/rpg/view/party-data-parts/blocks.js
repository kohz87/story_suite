// Finding the RPG blocks in the head state, and whether a Character block exists.

import { activeDefinition, instanceOf } from '../../../../packages/story-block/src/v2/data-modules/adapters.js';
import { isRecord } from './shared-basics.js';

/**
 * Every RPG block in the head state, in pin order: `{ module, role, subject, definition, fields }` per attached
 * subject (a chat block has one; a character block one per attached character). `roleOf(definition)` says what a
 * block is read as (default: its `role`).
 */
export function rpgBlocks(state, { roleOf = definition => definition?.role } = {}) {
    const domain = state?.domains?.dataModules;
    const out = [];
    for (const module of Object.keys(domain?.active ?? {})) {
        const definition = activeDefinition(state, module);
        const role = definition ? roleOf(definition) : null;
        if (!role) continue;
        const subjects = definition.scope === 'chat' ? ['chat'] : (domain.active[module].subjects ?? []);
        for (const subject of subjects) {
            const instance = instanceOf(state, module, subject);
            if (isRecord(instance?.fields)) out.push({ module, role, subject: subject === 'chat' ? null : subject, definition, fields: instance.fields, order: out.length });
        }
    }
    return out;
}

/** Whether the state has a Character block (the Party tab shows only then). */
export const hasCharacters = (state, options) => rpgBlocks(state, options).some(block => block.role === 'character');
