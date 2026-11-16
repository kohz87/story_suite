// The Prompt card's fold key, host setting keys, words and the budgets' form schema.

import { HOST_SETTINGS_SCHEMA } from '../../../../../../../core/sdk.js';


/** The fold key of the whole card (the Story Suite fold's old size block), and the host settings it draws. */
export const PROMPT_FOLD = 'story-suite::size';
export const PROMPT_KEYS = Object.freeze(['tailBudget', 'contextShare', 'maxChangeLines']);

export const PROMPT_TEXT = Object.freeze({
    title: 'Prompt',
    hint: 'what Story Suite adds to each reply',
    budgets: 'Budgets',
    footerLabel: 'What\'s sent each reply',
    footerNone: 'Open a chat to see it',
    footerValue: '{tail} of {budget} tokens',
    footerNotes: 'for the notes',
    footerAll: '{total} in all',
    footerTitle: 'Show what Story Suite adds to each reply',
});

// The budgets as sliders and a number (HOST_SETTINGS_SCHEMA's own bounds): the notes' budget in steps of 50 up to a
// slider's reach (a larger stored value stretches it), the share in steps of 5.
export const PROMPT_SCHEMA = Object.freeze({
    tailBudget: Object.freeze({ ...HOST_SETTINGS_SCHEMA.tailBudget, group: PROMPT_TEXT.budgets, form: 'slider', sliderMax: 6000, step: 50, unit: ' tokens' }),
    contextShare: Object.freeze({ ...HOST_SETTINGS_SCHEMA.contextShare, group: PROMPT_TEXT.budgets, form: 'slider', step: 5, unit: '%' }),
    maxChangeLines: Object.freeze({ ...HOST_SETTINGS_SCHEMA.maxChangeLines, group: PROMPT_TEXT.budgets }),
});
