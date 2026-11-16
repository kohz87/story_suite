// Levels: the part's settings schema (level cap, Auto cap, pre-check, story checks).

import { AUTO_CAP, AUTO_CAP_SETTING, CHECKS_SETTING, LEAN_RPG_FEATURE, LEVEL, LEVEL_CAP_SETTING, PRECHECK_SETTING } from '../names.js';

/** The part's settings schema: the level cap (Settings → RPG: a whole number from 1 to 99, 99 unset). */
export const SETTINGS_SCHEMA = Object.freeze({
    [LEVEL_CAP_SETTING]: Object.freeze({ type: 'int', min: LEVEL.min, max: LEVEL.max, group: 'RPG', label: 'Level cap', feature: LEAN_RPG_FEATURE,
        help: 'The highest level a new character can reach, from 1 to 99. A character made keeps the cap it was made with; the pack may name one.' }),
    [AUTO_CAP_SETTING]: Object.freeze({ type: 'int', min: AUTO_CAP.min, max: AUTO_CAP.max, group: 'RPG', label: 'Auto-fight: most exchanges per reply', feature: LEAN_RPG_FEATURE,
        help: 'How many exchanges Auto plays before it stops, 1 to 8, or 9 for until the end of the fight. Default 3.' }),
    [PRECHECK_SETTING]: Object.freeze({ type: 'bool', group: 'RPG', label: 'Set up a fight from my attack', feature: LEAN_RPG_FEATURE,
        help: 'When you type an attack and no foe is standing, a short call on your Assist profile finds the foes, so you fight on the board before the reply. Off: the narrator sets up the foes and the board opens after its reply.' }),
    [CHECKS_SETTING]: Object.freeze({ type: 'bool', group: 'RPG', label: 'Story checks', feature: LEAN_RPG_FEATURE,
        help: 'Rolls for attempts outside a fight, before the reply: three dice go in the note, the narrator reports each check, and code works out the result and gives practice. Works whatever Rolls says (it is for fights). Off: the narrator decides them (past results stay).' }),
});
