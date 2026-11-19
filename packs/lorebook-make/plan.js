// The job: deciding what Settings › Packs offers for a world pack's lorebook (Create, Update, Up to date; the Use in this chat tick) and what
// a Create or Update may do to the book already there (pure: the caller reads SillyTavern).

import { lorebookName, readMarker } from './marker.js';

/**
 * The row for an installed world pack with lore: `pack` = { id, name, version }; `names` = SillyTavern's book names; `made` = the hint kept in the
 * suite's settings ({ [pack id]: { name, version } }, written after each Create or Update); `chatBook` = this chat's lorebook ('' for none);
 * `hasChat` = a chat is open. → `{ state: 'create' | 'update' | 'current', name, madeFrom, attached, use: { on, disabled, note } }`.
 * The hint only draws the row; the book's own marker decides when the button is pressed (lorebookStep).
 */
export function lorebookRow({ pack, names = [], made = {}, chatBook = '', hasChat = true }) {
    const name = lorebookName(pack?.name ?? pack?.id);
    const exists = Array.isArray(names) && names.includes(name);
    const hint = made && typeof made === 'object' ? made[pack?.id] : null;
    const madeFrom = exists && hint?.name === name ? String(hint.version ?? '') : '';
    const state = !exists ? 'create' : madeFrom && madeFrom === String(pack?.version ?? '') ? 'current' : 'update';
    const attached = Boolean(chatBook) && chatBook === name;
    let use = { on: true, disabled: false, note: '' };
    if (!hasChat) use = { on: false, disabled: true, note: 'Open a chat to use the lorebook in it.' };
    else if (attached) use = { on: true, disabled: false, note: 'It is this chat’s lorebook.' };
    else if (chatBook) use = { on: false, disabled: false, note: `This chat already uses the lorebook ${chatBook}; tick to use this one instead.` };
    return { state, name, madeFrom, attached, use };
}

/**
 * What a Create or Update may do, from the book SillyTavern has under the name (`existing`, null when there is none):
 * `{ step: 'write' | 'confirm' | 'current' | 'refuse', update, message }`. A book of that name without the marker, or made from another pack, is the
 * reader's own and is never written over; a marker book of an older (or other) version is replaced only once the reader has confirmed.
 */
export function lorebookStep({ pack, name, existing = null, confirmed = false }) {
    if (!existing) return { step: 'write', update: false, message: '' };
    const marker = readMarker(existing);
    if (!marker) return { step: 'refuse', update: true, message: `A lorebook named ${name} is already there and Story Suite did not make it, so it is left as it is. Rename it in World Info, then try again.` };
    if (marker.pack !== String(pack?.id ?? '')) return { step: 'refuse', update: true, message: `The lorebook ${name} was made from another pack (${marker.pack}), so it is left as it is.` };
    if (marker.version === String(pack?.version ?? '')) return { step: 'current', update: true, message: '' };
    if (!confirmed) return { step: 'confirm', update: true, message: `This replaces the book ${name}; edits you made in it are lost.` };
    return { step: 'write', update: true, message: '' };
}
