// Reads the packs' foe bestiary (`content.foes`) for the foe pre-check, in pack order. Read only.

import { ask } from './shared-text.js';

/** The listed foes `[{ name, aliases, tier, level? }]`, or [] when no pack lists any (or nothing answers). */
export function bestiaryOf(query) {
    const list = ask(query, 'packs.content', { kind: 'foes' });
    return Array.isArray(list) ? list.filter(foe => foe && typeof foe.name === 'string' && typeof foe.tier === 'string') : [];
}
