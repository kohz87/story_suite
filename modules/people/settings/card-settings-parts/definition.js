// Builds the definition handed to sdk.registerCardSettings.

import { normalizePortraitPromptFormat } from '../../core-mechanics.js';
import { CARD_SETTINGS_OWNER, CARD_SETTINGS_LABEL } from './constants.js';
import { validPortraitPromptFormat, validScanEvery } from './validators.js';

// The names the prompt format has in Delta's own settings select.
const FORMAT_NAMES = Object.freeze({ hybrid: 'Structured hybrid', tags: 'Comma tags', natural: 'Natural' });

/**
 * The definition handed to sdk.registerCardSettings.
 *   readFormat()         the current prompt format
 *   saveFormat(format)   persists it like "Save prompt settings" (resolves true when saved)
 *   readScanEvery()      the current Scan every
 *   saveScanEvery(n)     persists it like the Scan every box
 */
export function createCardSettingsDefinition({ readFormat, saveFormat, readScanEvery, saveScanEvery } = {}) {
    return {
        owner: CARD_SETTINGS_OWNER,
        label: CARD_SETTINGS_LABEL,
        keys: {
            portraitPromptFormat: {
                label: 'NSD portraits',
                valueText: value => FORMAT_NAMES[normalizePortraitPromptFormat(value)],
                valid: validPortraitPromptFormat,
            },
            scanEvery: {
                label: 'NSD scan every',
                valueText: value => `${value} ${Number(value) === 1 ? 'reply' : 'replies'}`,
                valid: validScanEvery,
            },
        },
        read(key) {
            if (key === 'portraitPromptFormat') return normalizePortraitPromptFormat(readFormat?.());
            if (key === 'scanEvery') return readScanEvery?.();
            return undefined;
        },
        async apply(values = {}) {
            const applied = [];
            if (Object.prototype.hasOwnProperty.call(values, 'portraitPromptFormat') && validPortraitPromptFormat(values.portraitPromptFormat)) {
                if (await saveFormat?.(values.portraitPromptFormat) !== false) applied.push('portraitPromptFormat');
            }
            if (Object.prototype.hasOwnProperty.call(values, 'scanEvery') && validScanEvery(values.scanEvery)) {
                if (await saveScanEvery?.(values.scanEvery) !== false) applied.push('scanEvery');
            }
            return { applied };
        },
    };
}
