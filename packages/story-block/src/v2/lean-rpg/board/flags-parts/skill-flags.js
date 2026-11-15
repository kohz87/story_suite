// Infers a skill's target, area and defence flags from its words, with the reader's overrides on top.

import { AREA, DEFENCE } from './skill-words.js';

/** The inferred flags are independent; a skill can attack an area and also defend. */
export function defaultFlags(skill) {
    const words = `${skill?.name ?? ''} ${skill?.about ?? ''}`;
    const area = AREA.test(words), defence = DEFENCE.test(words);
    return { target: !area && !defence, area, defence };
}

/** A utility skill (the Skills block's `type`, read.js skillsOf) is for the story: the board never offers it, Auto never picks it, and it is never a defence. */
export const isUtility = skill => skill?.type === 'utility';

/** Use explicit boolean flags when present; older skills need no migration. A utility skill has none. */
export function skillFlags(skill, overrides = null) {
    if (isUtility(skill)) return { target: false, area: false, defence: false };
    const defaults = defaultFlags(skill);
    return Object.fromEntries(Object.keys(defaults).map(flag => [flag, typeof overrides?.[flag] === 'boolean' ? overrides[flag] : defaults[flag]]));
}
