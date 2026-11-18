// The job: keeping the lore digest between replies, read again only when the sources' text changed (nothing is stored in the chat).

import { hashJson } from '../../world/hash.js';
import { buildDigest } from './digest.js';
import { loreEntries } from './entries.js';

const EMPTY = Object.freeze({ lines: [], rev: '' });

/**
 * `{ refresh({ packLore }), digest(), entries() }` over `readLorebook()` (async, `{ entries }` as the packs' reader answers). `refresh` reads the
 * lorebook, puts it with the pack's lore entries and builds the digest only when a hash of the sources differs from the one kept; it never throws
 * (a lorebook that cannot be read counts as no lorebook, the pack's lore stays). `digest()` and `entries()` answer at once from what was last read.
 */
export function createLoreCache({ readLorebook }) {
    let key = '';
    let kept = { entries: [], digest: EMPTY };
    let pending = null;
    async function run(packLore) {
        let lorebook = [];
        try { lorebook = (await readLorebook())?.entries ?? []; } catch { lorebook = []; }
        const entries = loreEntries({ pack: packLore, lorebook });
        const hash = hashJson(entries);
        if (hash !== key) { key = hash; kept = { entries, digest: buildDigest(entries) }; }
        return kept.digest;
    }
    return {
        refresh({ packLore = [] } = {}) {
            pending = pending ?? run(packLore).finally(() => { pending = null; });
            return pending;
        },
        digest: () => kept.digest,
        entries: () => kept.entries,
    };
}
