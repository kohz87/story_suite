// The message table and the small copy/list helpers every check section uses.
import { dmObject } from '../../schema.js';
import { STRINGS } from '../../../../core/strings.js';

export const E = STRINGS.editMessages;

export const copy = value => JSON.parse(JSON.stringify(value));
export const entries = value => dmObject(value) ? Object.entries(value) : [];
export const array = value => Array.isArray(value) ? value : [];
