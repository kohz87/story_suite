/* NPC State Delta identity: slugifying a name and making a unique NPC id. */
import { normalizeName } from '../core-text.js';

export function slugify(value) {
    const slug = normalizeName(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'npc';
}

export function makeNpcId(name, existingIds = []) {
    const base = `npc_${slugify(name)}`;
    if (!existingIds.includes(base)) return base;
    let i = 2;
    while (existingIds.includes(`${base}_${i}`)) i += 1;
    return `${base}_${i}`;
}
