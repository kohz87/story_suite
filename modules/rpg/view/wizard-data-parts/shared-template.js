// The stock block templates the wizard builds from, and the names read off them.

import { CHOOSER_TEMPLATES } from '../../templates.js';
import { soulReading } from '../../soul.js';

// (Blocks are made from the chooser's templates, Combat Rules v1's: templates.js CHOOSER_TEMPLATES.)
export const template = role => structuredClone(CHOOSER_TEMPLATES.find(entry => entry.definition.role === role).definition);

/** What a character's class is called when no block names it (soul.js): "Soul Class", I to IX. Kept for join.js, which reads the class of a `+ party` line by it. */
export const newSoul = () => soulReading();

/** The block each extra role is made from, by its name: "Combat rules" and "Foes" (the stock templates, as Settings → Blocks offers them). */
export const extraName = role => CHOOSER_TEMPLATES.find(entry => entry.definition.role === role)?.name ?? role;
