// What a draft may hold: the level it starts at, where a stat starts and the skills the level (or a saved character) allows. Pure; the wizard's steps and the checks read these.
import { skillSlots } from '../module-parts/members.js';
import { RULES } from './rules.js';

/** The level the draft starts at (1 unless the Who step set a higher one). */
export const levelOf = draft => (Number.isInteger(draft?.level) && draft.level > 1 ? draft.level : 1);

/** Where a stat starts: 5, or the value a saved character came with (its points are counted from there). */
export const startOf = (draft, stat) => draft?.from?.stats?.[stat] ?? RULES.start[stat];

/** The skills the draft may hold: the slots of its level (5, one more every tenth level, 8 at most), or the skills a saved character brought if more (they are all kept). */
export const skillLimit = draft => Math.max(skillSlots(levelOf(draft)), draft?.from?.skills ?? 0);
