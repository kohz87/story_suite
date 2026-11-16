// How much of the prompt tail one module may take, in tokens.
import { DM_LIMITS as L } from '../../schema.js';
import { SKILL_SLOTS_BASE, skillFieldSlots } from '../../../../core/runtime/skill-slots.js';

// What a module may take of the prompt's tail: 100 tokens, 300 for a block with a `role` (the RPG's sheets carry text the story reads).
// `rpg` is whether the RPG feature is on: a block with a role is the RPG's to write only then; with it off the block is told like any other.
// A Skills block may say 47 tokens more for each skill it holds past five (the longest line one skill makes: a 40-character name and 120 of text, measured at 188
// characters); a slot that holds no skill reserves nothing. `fields` is the block's fields (none: nothing is held).
export const tailRoom = (definition, rpg = true, fields = null) => {
    if (!(rpg && definition?.role)) return Object.values(definition?.state ?? {}).some(schema => schema?.type === 'entries') ? L.listTailTokens : L.tailTokens;
    const held = definition.role === 'skills' && fields ? Array.from({ length: skillFieldSlots(fields) }, (_, i) => fields[`skill${i + 1}`]).filter(name => typeof name === 'string' && name.trim()).length : 0;
    return L.roleTailTokens + L.skillTailTokens * Math.max(0, held - SKILL_SLOTS_BASE);
};
