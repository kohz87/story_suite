// The at-most-one Adept starting skill rule.

import { CREATION } from '../../names.js';

/** How many skills start at Adept. */
export const adeptCount = draft => draft.skills.filter(skill => skill.start === 1).length;

/** Whether the skill at `index` may offer Adept: only when it is the Adept one, or nobody is yet. */
export const mayStartAdept = (draft, index) => draft.skills[index]?.start === 1 || adeptCount(draft) < CREATION.adept;
