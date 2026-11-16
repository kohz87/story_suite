// How many skill slots a character has and how its skills split into combat and utility pools.

import { UTILITY_SLOTS, skillSlots } from '../../../../../../../core/runtime/skill-slots.js';

/** How many slots the character's skills card shows: the slots the level opens (names.js skillSlots; a Skills block made before them is extended when the story first needs it, data-modules/part.js growSkills), never fewer than the skills it holds. */
export const slotsShown = character => Math.max(character.skills.length, skillSlots(character.level));
/** Whether the character's Skills block has the types (a `type1` field); one without is read as all combat. */
export const hasTypes = character => Object.hasOwn(character?.skillsBlock?.definition?.state ?? {}, 'type1');
export const isUtility = skill => skill.type === 'utility';
/** The two lists of a block with types: the skills of each kind, the slots each has (combat: the level's, never fewer than held) and how many are free. */
export function poolsOf(character) {
    const utility = character.skills.filter(isUtility), combat = character.skills.filter(skill => !isUtility(skill));
    const combatMax = Math.max(combat.length, skillSlots(character.level));
    return { combat, utility, combatMax, utilityMax: Math.max(utility.length, UTILITY_SLOTS) };
}
