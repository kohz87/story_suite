// The Standard formula's four templates in the chooser's order, and the same with the eight-slot Skills block.
import { standardCharacter } from './character.js';
import { skillsV2For, typedStandardSkills } from './skills.js';
import { standardFoes } from './foes.js';
import { standardCombat } from './combat.js';
import { COMBAT_V1_TEMPLATES } from '../templates-combat.js';

/** The Standard formula's four templates, in the chooser's order. Skills are the base block with the learn guard. */
export const STANDARD_TEMPLATES = Object.freeze([
    { name: 'Character', definition: standardCharacter },
    { name: 'Skills', definition: typedStandardSkills },
    { name: 'Foes', definition: standardFoes },
    { name: 'Combat rules', definition: standardCombat },
]);

/** The Standard templates with the Skills block as the eight-slot release had it (no types): what a chat made before the types still holds; the tests of such chats read it. */
export const STANDARD_TEMPLATES_EIGHT = Object.freeze(STANDARD_TEMPLATES.map(entry => (entry.name === 'Skills' ? { name: entry.name, definition: skillsV2For() } : entry)));

/** The templates every chat and every new sheet is made from: Combat Rules v1's four, in the chooser's order (the chooser, the New character wizard and the Combat rules settings read this). STANDARD_TEMPLATES stays for reading earlier chats. */
export const CHOOSER_TEMPLATES = COMBAT_V1_TEMPLATES;
