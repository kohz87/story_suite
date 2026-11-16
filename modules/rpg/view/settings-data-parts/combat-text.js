// The Combat rules text: its limit, its default and a fresh definition carrying it.

import { oneLine } from '../../../../core/text.js';
import { COMBAT_PROMPT_STANDARD, STANDARD_TEMPLATES } from '../../templates.js';

/** The most characters the Combat rules text may have (a block's "What it is for", data-modules/schema.js DM_LIMITS.prompt). */
export const COMBAT_MAX = 1200;

/** The text a Combat rules block starts with, as a block keeps it (one line): its roll types and the bars code moves. */
export const COMBAT_DEFAULT = oneLine(COMBAT_PROMPT_STANDARD);

/** A fresh Combat rules definition (the Standard template's text explains the roll types), for the "Add the Combat rules block" button. */
export const combatTemplate = () => {
    const entry = STANDARD_TEMPLATES.find(item => item.definition.role === 'rules');
    return entry ? structuredClone(entry.definition) : null;
};
