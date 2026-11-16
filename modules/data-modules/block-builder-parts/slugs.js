// Slugs and part keys: a block's unique slug and the one-word key of an entry part.
import { keyFor } from './shared-basics.js';

export function uniqueBlockSlug(name, used = []) {
    const base = keyFor(name) || 'block';
    const taken = new Set(['chat', ...used.map(value => String(value).split('/').at(-1))]);
    if (!taken.has(base)) return base;
    for (let n = 2; n < 10000; n++) {
        const suffix = `-${n}`, next = `${base.slice(0, 40 - suffix.length).replace(/-+$/, '')}${suffix}`;
        if (!taken.has(next)) return next;
    }
    return '';
}

// A List of entries field: its parts are named with one lowercase word (the label a story line writes), at most eight, none of them a list.
export const partKey = name => keyFor(name, 20).replace(/[^a-z]/g, '');
