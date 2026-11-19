// The job: deciding what Settings › Packs offers for a world pack's lorebook (Create, Update, Up to date; the Use with this character tick), what
// a Create or Update may do to the book already there, and how the book goes with the chat's character (pure: the caller reads SillyTavern).

import { lorebookName, readMarker } from './marker.js';

/**
 * How the book `name` goes with the chat's character, the SillyTavern way. `char` = null (no character chat) | `{ group: true }` | `{ name, world,
 * embedded, extras }`: the card's linked lorebook (`data.extensions.world`, '' for none), whether the card carries a lorebook of its own
 * (`data.character_book`), and the character's Additional lorebooks (world_info.charLore; null when not read yet).
 * → `{ step: 'none' | 'linked' | 'link' | 'add', who, note }`: `link` makes it the card's lorebook; `add` keeps the card's own book (linked or carried
 * in the card, which a link would write over) and adds this one to the Additional lorebooks; the chat lorebook is never used.
 */
export function characterStep({ name, char = null }) {
    if (!char) return { step: 'none', who: '', note: 'Open a character chat to use the lorebook with that character.' };
    if (char.group) return { step: 'none', who: '', note: 'This is a group chat: pick a character chat to use the lorebook with that character.' };
    const who = String(char.name ?? '') || 'the character';
    const world = String(char.world ?? '');
    if (world === name || (Array.isArray(char.extras) && char.extras.includes(name))) return { step: 'linked', who, note: `Linked to ${who}.` };
    if (!world && !char.embedded) return { step: 'link', who, note: '' };
    return { step: 'add', who, note: `${who} has its own lorebook${world ? ` (${world})` : ''}; this one is added beside it.` };
}

/**
 * The row for an installed world pack with lore: `pack` = { id, name, version }; `names` = SillyTavern's book names; `made` = the hint kept in the
 * suite's settings ({ [pack id]: { name, version } }, written after each Create or Update); `char` = the chat's character (characterStep);
 * `chatBook` = this chat's lorebook ('' for none), read only to offer moving a book an earlier version put there.
 * → `{ state: 'create' | 'update' | 'current', name, madeFrom, linked, who, move, use: { on, disabled, note } }` (`move`: the book is this chat's
 * lorebook and there is a character to move it to). The hint only draws the row; the book's own marker decides when the button is pressed.
 */
export function lorebookRow({ pack, names = [], made = {}, char = null, chatBook = '' }) {
    const name = lorebookName(pack?.name ?? pack?.id);
    const exists = Array.isArray(names) && names.includes(name);
    const hint = made && typeof made === 'object' ? made[pack?.id] : null;
    const madeFrom = exists && hint?.name === name ? String(hint.version ?? '') : '';
    const state = !exists ? 'create' : madeFrom && madeFrom === String(pack?.version ?? '') ? 'current' : 'update';
    const step = characterStep({ name, char });
    const use = step.step === 'none' ? { on: false, disabled: true, note: step.note } : { on: true, disabled: false, note: step.note };
    return { state, name, madeFrom, linked: step.step === 'linked', who: step.who, move: exists && step.step !== 'none' && chatBook === name, use };
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
