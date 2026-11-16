// The Character, Skills and Foes definitions of Combat Rules v1 (data only), in the chooser's order. NOT offered by the chooser yet: STANDARD_TEMPLATES still holds the earlier
// definitions, and the switch to these is one line in templates.js, made with the board wiring (the combat plan's C6). Public face: re-exports its parts.
import { characterV1 } from './templates-parts/v1-character.js';
import { skillsV1 } from './templates-parts/v1-skills.js';
import { foesV1 } from './templates-parts/v1-foes.js';
import { rulesV1 } from './templates-parts/v1-rules.js';

export { STATS_V1, TIER_NAMES } from './templates-parts/v1-shared.js';
export { SKILL_TYPE_NAMES } from './templates-parts/v1-skills.js';

/** The four v1 templates in the chooser's order. */
export const COMBAT_V1_TEMPLATES = Object.freeze([
    { name: 'Character', definition: characterV1 },
    { name: 'Skills', definition: skillsV1 },
    { name: 'Foes', definition: foesV1 },
    { name: 'Combat rules', definition: rulesV1 },
]);
