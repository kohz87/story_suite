// Validators for the two settings a character card may recommend.

import { PORTRAIT_PROMPT_FORMATS } from '../../core/core-mechanics.js';
import { SCAN_EVERY_RANGE } from './constants.js';

/** True only for the exact lowercase value of a format Delta has (no case or spacing variants). */
export function validPortraitPromptFormat(value) {
    return typeof value === 'string' && PORTRAIT_PROMPT_FORMATS.includes(value);
}

export function validScanEvery(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= SCAN_EVERY_RANGE.min && value <= SCAN_EVERY_RANGE.max;
}
