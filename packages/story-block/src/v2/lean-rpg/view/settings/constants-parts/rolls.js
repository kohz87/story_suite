// The Rolls setting's key, module and default, and how the reader's choice is read.

import { ROLLS_SETTING } from '../../../names.js';

export const ROLLS_DEFAULT = 'automatic';
/** The setting's key (the rolls piece's ROLLS_SETTING). */
export const ROLLS_KEY = ROLLS_SETTING;
export const SETTINGS_MODULE = 'story-block';

/** The reader's choice: 'automatic' or 'off'. */
export const rollsOf = settings => (settings?.(SETTINGS_MODULE)?.[ROLLS_KEY] === 'off' ? 'off' : ROLLS_DEFAULT);
