// The job: turning the two lore sources (the pack's lore entries and the open character's lorebook) into one plain list of lore entries.

import { isPackTitle, isPortraitsTitle, isSettingsTitle } from '../../../packs/lorebook.js';
import { isLorebookTitle } from '../../../packs/lorebook-make/marker.js';

export const MAX_KEYS = 12;
const PROTECTED_TAG = /\[\s*protected\s*\]/i;
const flat = value => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * `{ title, keys, text, protected, source }` entries, pack lore first, then the lorebook, in the order given. The Story Suite's own tagged
 * entries (pack, portraits, settings, and the marker of a book made from a pack) are not lore and are left out; so are entries with no text or no title. A lorebook entry is protected
 * when its title carries a `[protected]` tag; a pack's lore entry when it says `protected: true`. The same title twice keeps the first.
 */
export function loreEntries({ pack = [], lorebook = [] } = {}) {
    const out = [];
    const seen = new Set();
    const add = (raw, source, isProtected) => {
        const title = flat(String(raw?.title ?? '').replace(PROTECTED_TAG, ''));
        const text = String(raw?.text ?? '').trim();
        if (!title || !text || seen.has(title.toLowerCase())) return;
        seen.add(title.toLowerCase());
        const keys = (Array.isArray(raw?.keys) ? raw.keys : []).map(flat).filter(Boolean).slice(0, MAX_KEYS);
        out.push({ title, keys, text, protected: isProtected, source });
    };
    for (const entry of Array.isArray(pack) ? pack : []) add(entry, 'pack', entry?.protected === true);
    for (const entry of Array.isArray(lorebook) ? lorebook : []) {
        const title = String(entry?.title ?? '');
        if (isPackTitle(title) || isPortraitsTitle(title) || isSettingsTitle(title) || isLorebookTitle(title)) continue;
        add({ title, keys: entry?.keys, text: entry?.content }, 'lorebook', PROTECTED_TAG.test(title));
    }
    return out;
}
