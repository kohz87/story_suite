// Changes to the draft's skills: a set put in, a skill added, patched or taken out.

import { CREATION, STATS_V1 as STATS, USES } from '../../names.js';
import { SKILL_TYPE_NAMES } from '../../templates-combat.js';
import { UTILITY_SLOTS } from '../../../../core/runtime/skill-slots.js';
import { mayStartAdept } from './adept.js';
import { combatSlots, draftSlots, utilityCount } from './slots.js';
import { oneLine } from './shared-helpers.js';

const blankSkill = type => ({ name: '', about: '', stat: STATS[0], uses: USES[0], start: 0, ...(type === 'utility' ? { type } : {}) });

/** A skill set put into the draft: its skills (up to the draft's slots), every one at Novice. */
export function withSet(draft, set) {
    // (signature skills stay in front; the set fills the slots after them: its combat skills the combat slots left, its utility skills the utility slots left)
    const signed = draft.skills.filter(skill => skill.sig === true);
    const kept = draft.skills.filter(skill => skill.type === 'utility' && skill.sig !== true && skill.fromSet !== true && skill.name);   // (a utility skill the reader made, not one a set put in earlier)
    const room = { combat: Math.max(0, combatSlots(draft) - signed.filter(skill => skill.type !== 'utility').length), utility: Math.max(0, UTILITY_SLOTS - signed.filter(skill => skill.type === 'utility').length - kept.length) };
    const skills = (set?.skills ?? []).filter(skill => {
        const pool = skill.type === 'utility' ? 'utility' : 'combat';
        if (room[pool] <= 0) return false;
        room[pool] -= 1;
        return true;
    }).map(skill => ({
        name: oneLine(skill.name, CREATION.skillName), about: oneLine(skill.about, CREATION.skillAbout),
        stat: STATS.includes(skill.stat) ? skill.stat : skill.stat === 'luk' ? 'wis' : STATS[0], uses: USES.includes(skill.uses) ? skill.uses : USES[0], start: 0, fromSet: true,
        // (the set's own type, as a skill the reader adds by hand keeps one: attack is the default and is not written)
        ...(SKILL_TYPE_NAMES.includes(skill.type) && skill.type !== 'attack' ? { type: skill.type } : {}),
    }));
    return { ...draft, skills: [...signed, ...kept, ...skills], set: String(set?.id ?? '') };
}

/** A new blank skill added to the draft, when there is room. */
export const withSkill = draft => (draft.skills.length >= draftSlots(draft) ? draft
    : { ...draft, skills: [...draft.skills, blankSkill(draft.skills.length - utilityCount(draft) >= combatSlots(draft) ? 'utility' : 'combat')] });

/**
 * One skill changed (`patch`: any of name, about, stat, uses, start); a second Adept is refused. A signature skill (a pack's cast member brought it) takes the
 * pencil's changes only, its name and what it does; its stat, resource and rank stay as the pack wrote them.
 */
export function withSkillPatch(draft, index, patch) {
    if (!draft.skills[index]) return draft;
    const only = draft.skills[index].sig === true ? { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.about !== undefined ? { about: patch.about } : {}) } : patch;
    const next = { ...draft.skills[index], ...only };
    // (`type`: one of the eight skill types, utility being the story-only one; a pool that is full refuses it)
    if (patch.type !== undefined && draft.skills[index].sig !== true) {
        const { type: _type, fromSet: _from, ...rest } = next, others = utilityCount(draft, index);
        const fits = patch.type === 'utility' ? others < UTILITY_SLOTS : draft.skills.length - others - 1 < combatSlots(draft);
        if (!fits) return draft;
        return { ...draft, skills: draft.skills.map((skill, at) => (at === index ? { ...rest, ...(SKILL_TYPE_NAMES.includes(patch.type) && patch.type !== 'attack' ? { type: patch.type } : {}) } : skill)) };
    }
    if (next.start === 1 && !mayStartAdept(draft, index)) next.start = 0;
    return { ...draft, skills: draft.skills.map((skill, at) => (at === index ? next : skill)) };
}

/** The skill at `index` taken out (a signature skill stays). */
export const withoutSkill = (draft, index) => ({ ...draft, skills: draft.skills.filter((skill, at) => at !== index || skill.sig === true) });
