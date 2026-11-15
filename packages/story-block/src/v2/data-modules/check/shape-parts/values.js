// Stable comparison of values, definition ids and Unicode key collisions.
import { dmObject } from '../../schema.js';

export const stable = value => value === null || typeof value !== 'object' ? value : Array.isArray(value) ? value.map(stable)
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
export const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
export const defId = (packId, slug) => `pack.${packId}/${typeof slug === 'string' ? slug : 'invalid'}`;

export function normalizedKeys(value, path, add) {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) {
        const seen = new Set();
        for (const key of Object.keys(value)) {
            const folded = key.normalize('NFKC');
            if (seen.has(folded)) add('DM_SCHEMA', `${path}.${key}`, 'Object keys collide after Unicode normalization.');
            seen.add(folded);
        }
    }
    for (const [key, child] of Object.entries(value)) normalizedKeys(child, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, add);
}
