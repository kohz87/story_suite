// The stock block templates the wizard builds from, and the names read off them.

import { CHOOSER_TEMPLATES, STANDARD_TEMPLATES } from '../../templates.js';
import { soulReading } from '../../soul.js';

// (Blocks are made from the chooser's templates, Combat Rules v1's: templates.js CHOOSER_TEMPLATES.)
export const template = role => structuredClone(CHOOSER_TEMPLATES.find(entry => entry.definition.role === role).definition);

/** The earlier (Standard) rules' template for a role: only for a chat that already holds blocks made from them. */
export const standardTemplate = role => structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === role).definition);

/** What a character the wizard makes calls its Soul Class (soul.js): the Character template's own label and names. Kept for join.js, which still reads it; the wizard itself says "Lv". */
export const newSoul = () => soulReading(standardTemplate('character').state.soul);

/** The block each extra role is made from, by its name: "Combat rules" and "Foes" (the stock templates, as Settings → Blocks offers them). */
export const extraName = role => CHOOSER_TEMPLATES.find(entry => entry.definition.role === role)?.name ?? role;
