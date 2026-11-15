// Opening a secret the story told: clearing the secret mark on the matching entries.
import { sameFact } from './shared-clean.js';
import { knowOf, listOf } from './read.js';

/**
 * The story (or a `told` line) opens a secret: the matching entries (same about and fact, ignoring case) lose `secret`.
 * → the new leaf text, or null when nothing matches (nothing to write).
 */
export function openKnow(prior, about, fact) {
    const target = knowOf({ about, fact, how: 'saw', r: 0 });
    if (!target) return null;
    const list = listOf(prior);
    if (!list.some(entry => entry.secret && sameFact(entry, target))) return null;
    return JSON.stringify(list.map(entry => {
        if (!entry.secret || !sameFact(entry, target)) return entry;
        const { secret, ...rest } = entry;
        return rest;
    }));
}
