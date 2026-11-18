// The job: the lore digest's wiring into the arc part: its feature switch, its two queries and the hook that reads the sources before a reply.

import { readCharacterLorebook } from '../../../packs/st-adapter.js';
import { createLoreCache } from './cache.js';
import { loreFor } from './match.js';

/** The world events engine's switch (default off): with it off nothing here is asked, read or answered. */
export const WORLD_EVENTS_FEATURE = 'story-director.world-events';

const tagged = fn => Object.assign(fn, { feature: WORLD_EVENTS_FEATURE });
const flat = value => String(value ?? '').replace(/\s+/g, ' ').trim();

/** The pack's lore entries `{ title, keys, text, protected }` from the enabled packs' `packs.content({ kind: 'lore' })`, [] when there are none. */
export function packLoreOf(query) {
    let list = null;
    try { list = typeof query === 'function' ? query('packs.content', { kind: 'lore' }) : null; } catch { list = null; }
    return (Array.isArray(list) ? list : []).filter(item => item && typeof item === 'object').map(item => ({
        title: flat(item.title ?? item.name), keys: item.keys ?? item.key, text: item.text ?? item.content, protected: item.protected === true,
    }));
}

/** The live cache over the open character's lorebook, and the part pieces that use it (`queries`, `hooks`; the switch is declared once, in the chronicle part). */
export function createLoreDigestPart({ cache = createLoreCache({ readLorebook: readCharacterLorebook }) } = {}) {
    const beforeGenerate = async view => {
        await cache.refresh({ packLore: packLoreOf(typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null) });
        return undefined;
    };
    return {
        cache,
        queries: {
            'director.loreDigest': tagged(() => cache.digest()),
            'director.loreFor': tagged((_state, args) => loreFor(cache.entries(), args ?? {})),
        },
        hooks: { beforeGenerate: tagged(beforeGenerate) },
    };
}
