// Checking one declared world condition: `{ name, scope, fades, means }` (pack content `conditions`).

import { oneLine } from '../../../core/text.js';
import { CONDITION_NAME, SCOPES } from '../../../modules/world/chronicle/conditions/limits.js';
import { fadeMinutes } from '../../../modules/world/chronicle/conditions/fade.js';
import { isText } from '../core.js';

const CONDITION_FIELDS = ['name', 'slug', 'scope', 'fades', 'means'];

export function checkCondition(record, path, label, add) {
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!CONDITION_FIELDS.includes(key)) say(key, `"${key}" is not a condition field (expected ${CONDITION_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    if (!CONDITION_NAME.test(record.name)) say('name', 'name must be lower-case words joined by "-", like "grain-dear".');
    if (!SCOPES.includes(record.scope)) say('scope', `scope must be one of ${SCOPES.join(', ')}.`);
    const fades = record.fades ?? 'until cleared';
    if (fadeMinutes(fades) === undefined) say('fades', 'fades must be a duration like "10 days" or "1 season", or "until cleared".');
    if (!isText(record.means, 300) || !record.means.trim()) say('means', 'means must be one plain sentence of at most 300 characters.');
    if (!ok) return null;
    return { name: record.name, scope: record.scope, fades: oneLine(fades, 40), means: oneLine(record.means, 300) };
}
