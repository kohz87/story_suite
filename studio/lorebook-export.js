// What "Export lorebook" gives: the open world pack's lore as the SillyTavern World Info book packs/lorebook-make builds (hidden entries kept out),
// the file's name, and the sentence the Studio shows beside the button (how many entries go, how many hidden ones stay out, or why it is off). Pure.

import { lorebookFromPack } from '../packs/lorebook-make/convert.js';

const SAFE = /[^a-z0-9.-]+/gi;
const entries = n => `${n} ${n === 1 ? 'entry' : 'entries'}`;

/**
 * Whether Export lorebook may go for `pack` (`{ doc, kind, legacy }`) and what to say: `{ on, note }` (`note` is null when there is no pack to talk about).
 * It is off for a game pack, an old-format pack, a world with no lore, and a world whose lore is all hidden.
 */
export function loreState(pack) {
    if (!pack?.doc || pack.legacy) return { on: false, note: null };
    if (pack.kind !== 'world') return { on: false, note: 'Export lorebook is off: a game pack has no lore.' };
    const { counts } = lorebookFromPack(pack.doc);
    if (!counts.entries) {
        const why = counts.hidden ? (counts.hidden === 1 ? 'its one lore entry is hidden' : `all ${counts.hidden} lore entries are hidden`) : 'this world has no lore';
        return { on: false, note: `Export lorebook is off: ${why}.` };
    }
    return { on: true, note: `${entries(counts.entries)}; ${counts.hidden} hidden ${counts.hidden === 1 ? 'entry' : 'entries'} kept out.` };
}

/** The world's lorebook file: `{ name: "<pack id>-lorebook.json", bytes }`, or null when `loreState` says it is off. */
export function exportLorebook(pack) {
    if (!loreState(pack).on) return null;
    const { book } = lorebookFromPack(pack.doc, { packName: pack.doc.name });
    const id = String(pack.doc.id ?? '').replace(SAFE, '-') || 'pack';
    return { name: `${id}-lorebook.json`, bytes: new TextEncoder().encode(JSON.stringify(book, null, 2)) };
}
