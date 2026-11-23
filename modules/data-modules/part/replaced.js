// While a feature that replaces the RPG is on (Text RPG) and the RPG itself is off, the RPG's role blocks (character, skills, foes, rules) are quiet: no grammar, no tail line, their lines refused as FEATURE_OFF.
import { LEAN_RPG_FEATURE, ROLES } from '../../rpg/names.js';

/** Whether `definition` is a block of an RPG role that is quiet now (`replaced`: the RPG is off and a feature that replaces it is on). Its stored values stay. */
export const quietRole = (definition, replaced) => replaced === true && ROLES.includes(definition?.role);

/** Whether a story line for `definition` is refused quietly now: an RPG role block while a feature that replaces the RPG is on (a Re-read of a kept line runs `again`, which sees the RPG on). */
export const replacedLine = (ctx, definition) => ctx.cause === 'story' && ctx.feature?.(LEAN_RPG_FEATURE) === false && ctx.featureOrReplacement?.(LEAN_RPG_FEATURE) === true && ROLES.includes(definition?.role);
