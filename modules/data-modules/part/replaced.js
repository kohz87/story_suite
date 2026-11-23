// While a feature that replaces the RPG is on (Text RPG) and the RPG itself is off, the RPG's role blocks (character, skills, foes, rules) are quiet: no grammar, no tail line, their lines refused as FEATURE_OFF.
import { ROLES } from '../../rpg/names.js';

/** Whether `definition` is a block of an RPG role that is quiet now (`replaced`: the RPG is off and a feature that replaces it is on). Its stored values stay. */
export const quietRole = (definition, replaced) => replaced === true && ROLES.includes(definition?.role);
