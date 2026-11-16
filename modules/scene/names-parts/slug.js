// A story slug for an item name (ASCII, or a hash for a name with no Latin letters). Pure.

import { aliasKey } from './clean.js';

// FNV-1a over the name, in base36: a stable slug for a name with no Latin letters or digits.
function hashSlug(text) {
    let hash = 0x811c9dc5;
    for (const char of text) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
}

/**
 * "Moonveil Trout" → "moonveil-trout": ASCII letters and digits only, as check.js's DEF_ID wants
 * (accents dropped); a name with none of them ("魔剣") gets "item-<hash of the name>".
 */
export function slugify(name) {
    const key = aliasKey(name);
    const slug = key
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48)
        .replace(/-+$/, '');
    return slug || `item-${hashSlug(key)}`;
}
