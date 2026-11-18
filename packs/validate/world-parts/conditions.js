// Checking one declared world condition: `{ name, scope, fades, means }` (pack content `conditions`).

import { oneLine } from '../../../core/text.js';
import { CONDITION_NAME, SCOPES } from '../../../modules/world/chronicle/conditions/limits.js';
import { fadeMinutes } from '../../../modules/world/chronicle/conditions/fade.js';
import { CONDITION_EFFECT_FIELDS } from '../../limits.js';
import { isObject, isText } from '../core.js';

const CONDITION_FIELDS = ['name', 'slug', 'scope', 'fades', 'means', 'effects', 'placeStatus', 'open'];

export function checkCondition(record, path, label, add) {
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!CONDITION_FIELDS.includes(key)) say(key, `"${key}" is not a condition field (expected ${CONDITION_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    if (!CONDITION_NAME.test(record.name)) say('name', 'name must be lower-case words joined by "-", like "grain-dear".');
    if (!SCOPES.includes(record.scope)) say('scope', `scope must be one of ${SCOPES.join(', ')}.`);
    const fades = record.fades ?? 'until cleared';
    if (fadeMinutes(fades) === undefined) say('fades', 'fades must be a duration like "10 days" or "1 season", or "until cleared".');
    if (!isText(record.means, 300) || !record.means.trim()) say('means', 'means must be one plain sentence of at most 300 characters.');
    if (record.placeStatus !== undefined && record.placeStatus !== true) say('placeStatus', 'placeStatus must be true (the condition shows as the place\'s status).');
    if (record.open !== undefined && record.open !== true) say('open', 'open must be true (the Director may set or clear the condition through an open template\'s menu).');
    const effects = record.effects === undefined ? null : checkEffects(record.effects, say);
    if (!ok) return null;
    return { name: record.name, scope: record.scope, fades: oneLine(fades, 40), means: oneLine(record.means, 300), ...(effects ? { effects } : {}), ...(record.placeStatus === true ? { placeStatus: true } : {}), ...(record.open === true ? { open: true } : {}) };
}

// `effects: { prices?: { <category | "all">: "×N" }, routes?: null | "blocked" | "×N speed" }`: price multipliers above 0; route effects applied by code.
function checkEffects(effects, say) {
    if (!isObject(effects)) return say('effects', 'effects must be { "prices": { "grain": "×2" }, "routes": "blocked" }.'), null;
    for (const key of Object.keys(effects)) if (!CONDITION_EFFECT_FIELDS.includes(key)) say(`effects.${key}`, `"${key}" is not an effect (expected ${CONDITION_EFFECT_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const out = {};
    if (effects.prices !== undefined) {
        if (!isObject(effects.prices)) say('effects.prices', 'prices must map goods categories to "×N".');
        else for (const [category, factor] of Object.entries(effects.prices)) {
            const match = typeof factor === 'string' ? /^×(\d+(?:\.\d+)?)$/.exec(factor.trim()) : null;
            if (!match || !(Number(match[1]) > 0)) say(`effects.prices.${category}`, `the price effect for "${category}" must be "×N" with N above 0 (zero and negative are refused).`);
        }
        out.prices = { ...effects.prices };
    }
    if (effects.routes !== undefined) {
        if (effects.routes !== null && effects.routes !== 'blocked' && !/^×\d+(?:\.\d+)? speed$/.test(String(effects.routes))) say('effects.routes', 'routes must be "blocked", "×N speed" (×0 blocks) or null.');
        out.routes = effects.routes;
    }
    return out;
}
