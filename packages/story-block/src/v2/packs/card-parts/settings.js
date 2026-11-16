// The settings entry of a card: its recommended keys checked against the allow-list (nothing is applied here).

import { CARD_SETTING_KEYS } from './limits.js';
import { isObject, parse } from './shared-read.js';

/**
 * The settings entry's text → `{ ok: true, values: { 'owner.key': value }, lines }` or `{ ok: false, values: {}, lines }`. Keys that are
 * not on the allow-list are skipped with a line; whether a value fits is for the owner that registered the key (card-settings.js).
 */
export function readSettingsEntry(text) {
    const lines = [];
    const refuse = message => ({ ok: false, values: {}, lines: [`The card's recommended settings were not used: ${message}`] });
    const data = parse(text);
    if (!isObject(data)) return refuse('the entry is not JSON.');
    if (data.v !== 1) return refuse('its "v" is not 1.');
    if (!isObject(data.settings)) return refuse('"settings" is missing.');
    const values = {};
    for (const [key, value] of Object.entries(data.settings)) {
        if (!CARD_SETTING_KEYS.includes(key)) { lines.push(`Card setting ${key.slice(0, 80)} skipped: it is not one a card may recommend.`); continue; }
        values[key] = value;
    }
    return { ok: true, values, lines };
}
