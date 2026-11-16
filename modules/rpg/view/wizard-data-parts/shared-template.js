// The stock block templates the wizard builds from, and the names read off them.

import { STANDARD_TEMPLATES } from '../../templates.js';
import { soulReading } from '../../soul.js';

// (Blocks are made from the Standard templates: templates.js STANDARD_TEMPLATES.)
export const template = role => structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === role).definition);

/** What a character the wizard makes calls its Soul Class (soul.js): the Character template's own label and names. Kept for join.js, which still reads it; the wizard itself says "Lv". */
export const newSoul = () => soulReading(template('character').state.soul);

/** The block each extra role is made from, by its name: "Combat rules" and "Foes" (the stock templates, as Settings → Blocks offers them). */
export const extraName = role => STANDARD_TEMPLATES.find(entry => entry.definition.role === role)?.name ?? role;
