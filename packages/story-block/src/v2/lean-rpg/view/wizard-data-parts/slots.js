// How many skill slots a draft may fill and how many are kept or utility.

import { SKILL_SLOTS_MAX, UTILITY_SLOTS, skillSlots } from '../../../skill-slots.js';
import { draftLevel } from './creation.js';
import { isRecord } from './shared-helpers.js';

/**
 * How many skills a draft may hold: 5, and one more at Lv 20, 40 and 60 for a draft that starts that high (names.js skillSlots). Creation still starts at 5.
 * Skills already ranked (a character file's, however many it holds after a level drop) and signature skills (a pack's cast member brought them) are kept
 * whatever the level says: the slots they fill are not taken away, there are just no new ones.
 */
export const draftSlots = draft => combatSlots(draft) + UTILITY_SLOTS;

/** The combat slots a draft may fill (the level's; kept skills never lose theirs) and the utility ones it has (three, whatever the level). */
export const combatSlots = draft => Math.max(skillSlots(draftLevel(draft)), keptSkills(draft?.skills, draft?.from));

export const utilityCount = (draft, except = -1) => (draft?.skills ?? []).filter((skill, at) => skill.type === 'utility' && at !== except).length;

export const keptSkills = (skills, from) => Math.min(SKILL_SLOTS_MAX, (Array.isArray(skills) ? skills : []).filter(entry => isRecord(entry) && ((entry.sig === true && entry.type !== 'utility') || (from && entry.type !== 'utility' && Number.isSafeInteger(entry.rank)))).length);
