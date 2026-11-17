// The Character and Skills definitions of the earlier (Standard) rules, made as a chat before Combat Rules v1 made them: kept so that a Re-read of a join in such a chat builds the same blocks again.

import { uniqueBlockSlug } from '../../../data-modules/block-builder.js';
import { blockNames } from './block-names.js';
import { STATS_EARLIER as STATS } from '../../names.js';
import { classOfLevel, levelOfClass } from '../../formula.js';
import { characterV1For, skillsV1For, skillsV2For } from '../../templates.js';
import { barFields } from '../../blocks.js';
import { pointsLeft } from './stats.js';
import { standardTemplate as template } from './shared-template.js';

/**
 * The two definitions Create makes, from the templates with the wizard's values written as the fields' defaults (so one `dm.define`
 * each makes the whole block, and the Skills block's `rankN` stays a field only play can move). `used` is the ids of the blocks
 * the chat has, so the slugs are free; `points` sets the Character's unspent points (a companion who joins starts with none, the
 * wizard's the budget left); `legacy` builds the Skills block of 2.21 (five slots, no signature mark); `cap` is the story's level cap (rules.js levelCapFor, 99 unset); `scale` the bar sizes (2, or 1 for the earlier ones). → { character, skills } (definitions, the Character first)
 */
export function buildStandardDefinitions(draft, { used = [], points = null, cap = null, legacy = false, scale = 2, typed = true } = {}) {
    const names = blockNames(draft.name);
    // (`scale`: 2 for the doubled bars, the template's; 1 builds the Character as it was before them, for a companion joining a chat that has only such characters)
    const character = scale === 2 ? template('character') : characterV1For();
    character.slug = uniqueBlockSlug(names.character, used);
    character.name = names.character;
    const state = character.state;
    state.who.default = draft.name;
    state.about.default = draft.about ?? '';
    for (const stat of STATS) state[stat].default = draft.stats[stat];
    state.points.default = Number.isSafeInteger(points) ? Math.max(0, points) : Math.max(0, pointsLeft(draft));
    // The Standard formula's bars are rows of blocks that grow with VIT, AGI and INT: a new character starts with them full, and the hidden fields
    // that remember each bar's size start there too (blocks.js barFields), so the block's size rules find nothing to change.
    for (const [key, value] of Object.entries(barFields(draft.stats, scale))) if (state[key]) state[key].default = Math.min(value, Number.isSafeInteger(state[key].max) ? state[key].max : value);
    // The starting level (the draft's `level`, 1 to 99; a companion or a file that came with a Soul Class has the level it stands for): into the block's `level` field,
    // held to the story's cap (levelCapFor, 99 unset), with the cap as the block's `cap`; a block of the earlier rules gets the class the level stands for.
    const top = Number.isSafeInteger(cap) ? Math.max(1, Math.min(99, cap)) : 99;
    const wanted = draft.level > 1 ? draft.level : draft.soul >= 1 ? levelOfClass(draft.soul) : 1;   // (a draft read by readDraft has `level`; a raw one may still say the class)
    const start = Math.min(top, wanted);
    if (state.level) { state.level.default = start; state.cap.default = top; }
    else if (start > 1) state.soul.default = classOfLevel(start);
    // (`legacy`: the Skills block as 2.21 made it, for a Re-read of a join made before the extra slots; such a draft carries no skills)
    const skills = legacy ? skillsV1For() : typed ? template('skills') : skillsV2For();
    skills.slug = uniqueBlockSlug(`${draft.name} skills`, [...used, character.slug]);
    skills.name = names.skills;
    skills.state.who.default = draft.name;
    draft.skills.forEach((skill, at) => {
        const n = at + 1;
        skills.state[`skill${n}`].default = skill.name;
        skills.state[`about${n}`].default = skill.about;
        skills.state[`stat${n}`].default = skill.stat;
        skills.state[`uses${n}`].default = skill.uses;
        skills.state[`rank${n}`].default = Number.isSafeInteger(skill.rank) ? skill.rank : skill.start;
        if (skills.state[`type${n}`] && skill.type === 'utility') skills.state[`type${n}`].default = 'utility';
        // (a skill a pack's cast member brought: marked in the Skills block's `sig`, so the story never renames or replaces it)
        if (skill.sig === true && skills.state.sig) skills.state.sig.default += 2 ** (n - 1);
    });
    return { character, skills };
}
