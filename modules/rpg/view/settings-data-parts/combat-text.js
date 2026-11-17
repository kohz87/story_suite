// The Combat rules text: its limit, its default and a fresh definition carrying it.

import { oneLine } from '../../../../core/text.js';
import { COMBAT_PROMPT_V1, CHOOSER_TEMPLATES } from '../../templates.js';

/** The most characters the Combat rules text may have (a block's "What it is for", data-modules/schema.js DM_LIMITS.prompt). */
export const COMBAT_MAX = 1200;

/** The text a Combat rules block starts with, as a block keeps it (one line): how a fight is told and what code moves. */
export const COMBAT_DEFAULT = oneLine(COMBAT_PROMPT_V1);

/** A fresh Combat rules definition (the Combat Rules v1 template's text), for the "Add the Combat rules block" button. */
export const combatTemplate = () => {
    const entry = CHOOSER_TEMPLATES.find(item => item.definition.role === 'rules');
    return entry ? structuredClone(entry.definition) : null;
};
