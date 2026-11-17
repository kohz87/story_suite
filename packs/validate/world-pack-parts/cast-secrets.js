// The job: checking a world-pack person's secrets: the spec form { id, gate, text, writes_fact? } or the old form { title, text, meter + at, when }, never both
// (writes_fact only on the spec form).

import { CAST_SECRET_FIELDS, SLUG, WORLD_CAST_LIMITS } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
import { isObject } from '../core.js';
import { plain } from './cast-fields.js';

const SPEC = ['id', 'gate', 'text', 'writes_fact'];
const OLD = CAST_SECRET_FIELDS;

/** Shape only (the gate text is read once every person is known: see cast-pass.js). Returns the kept secrets. */
export function secrets(value, say) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > WORLD_CAST_LIMITS.secrets) return say('secrets', `secrets must be a list of at most ${WORLD_CAST_LIMITS.secrets}.`), [];
    const ids = new Set();
    return value.flatMap((secret, n) => {
        const at = `secrets[${n}]`;
        if (!isObject(secret)) return say(at, `${at} must be an object.`), [];
        const spec = secret.id !== undefined || secret.gate !== undefined;
        const old = Object.keys(secret).some(key => OLD.includes(key) && key !== 'text');
        if (spec && old) return say(at, `${at} mixes the spec fields (id, gate) with the old ones (title, meter, at, when); use one shape.`), [];
        for (const key of Object.keys(secret)) if (!(spec ? SPEC : OLD).includes(key)) say(`${at}.${key}`, `"${key}" is not a secret field here (expected ${(spec ? SPEC : OLD).join(', ')}).`, 'UNKNOWN_FIELD');
        if (!plain(secret.text, 600)) return say(`${at}.text`, `${at}.text must be plain text of 1 to 600 characters.`), [];
        if (!spec) return [JSON.parse(JSON.stringify({ ...secret, text: oneLine(secret.text) }))];
        if (typeof secret.id !== 'string' || !SLUG.test(secret.id)) return say(`${at}.id`, `${at}.id must be lower-case-with-hyphens.`), [];
        if (ids.has(secret.id)) return say(`${at}.id`, `two secrets share the id "${secret.id}".`, 'DUPLICATE'), [];
        ids.add(secret.id);
        if (typeof secret.gate !== 'string' || !secret.gate.trim()) return say(`${at}.gate`, `${at}.gate is one string (no object form).`), [];
        if (secret.writes_fact !== undefined && (typeof secret.writes_fact !== 'string' || !SLUG.test(secret.writes_fact))) return say(`${at}.writes_fact`, `${at}.writes_fact is a fact id (lower-case-with-hyphens).`), [];
        return [{ id: secret.id, gate: secret.gate.trim(), text: oneLine(secret.text), ...(secret.writes_fact ? { writes_fact: secret.writes_fact } : {}) }];
    });
}
