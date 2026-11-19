// The job: Create or Update a world pack's lorebook and use it with the chat's character, told in words: the converter, the book already there (its
// marker), the save through SillyTavern, the character's lorebook or Additional lorebooks, and moving a book an earlier version made this chat's
// lorebook over to the character; the hint of what was made is kept in the suite's settings (`storySuite.lorebooks`).

import { lorebookFromPack } from './convert.js';
import { characterStep, lorebookRow, lorebookStep } from './plan.js';
import { readMarker } from './marker.js';

const said = (ok, text, extra = {}) => ({ ok, text, errors: [], ...extra });
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const reason = error => String(error?.message ?? error ?? 'it did not work');

/** The hints kept in the suite's settings: `{ [pack id]: { name, version } }`. */
export function madeHints(settings) {
    const value = settings?.read?.()?.lorebooks;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

// The book with the chat's character (plan.js characterStep, decided on the character as SillyTavern has it now) → { ok, text }.
async function withCharacter(books, name) {
    let step;
    try { step = characterStep({ name, char: await books.characterNow() }); } catch (error) { return { ok: false, text: `It was not linked to the character (${reason(error)}).` }; }
    if (step.step === 'none') return { ok: false, text: step.note };
    if (step.step === 'linked') return { ok: true, text: step.note };
    try { await (step.step === 'link' ? books.link(name) : books.addExtra(name)); } catch (error) { return { ok: false, text: `It was not linked to ${step.who} (${reason(error)}).` }; }
    return { ok: true, text: step.step === 'link' ? `Linked to ${step.who}.` : `Added to ${step.who}’s lorebooks (${step.who} keeps its own).` };
}

// Move: the chat's lorebook is this pack's book (its name and its marker) → it goes with the character, then the chat lorebook is unset; any other
// chat lorebook (a MemoryBooks book, the reader's own) is never touched.
async function moveToCharacter(books, pack, name, existing) {
    if (books.chatBook() !== name || readMarker(existing)?.pack !== String(pack.id)) return said(false, `This chat’s lorebook is not ${name}, so it is left as it is.`);
    const done = await withCharacter(books, name);
    if (!done.ok) return said(false, `${done.text} It stays this chat’s lorebook for now.`);
    try { await books.clearChatBook(name); } catch (error) { return said(false, `${done.text} It is still this chat’s lorebook (${reason(error)}).`); }
    return said(true, `${done.text} It is no longer this chat’s lorebook.`);
}

/**
 * `deps` = { packs (installed.js: `get(id)`), books (st-adapter stLorebooks()), settings ({ read, save }) }; `request` = { id, use, confirmed, move }.
 * → `{ ok, text, errors }`, `confirm: true` with the confirm card's words when the book there is to be replaced and the reader has not said yes,
 * `state: 'current'` when the book is the pack's version already (then only the character's lorebooks may change). `move` saves no book: it
 * moves this pack's book from the chat lorebook to the character.
 */
export async function makeLorebook({ packs, books, settings }, { id, use = true, confirmed = false, move = false } = {}) {
    const pack = packs?.get?.(String(id ?? ''));
    if (!pack || pack.kind !== 'world') return said(false, 'That world pack is not installed.');
    const { name, book, counts } = lorebookFromPack(pack);
    if (!counts.entries) return said(false, `${pack.name} has no lore to put in a lorebook.`);
    let step, existing;
    try {
        const names = await books.refresh();
        existing = names.includes(name) ? await books.load(name) : null;
        step = lorebookStep({ pack, name, existing, confirmed });
    } catch (error) { return said(false, `The lorebook could not be read from SillyTavern (${reason(error)}).`); }
    if (move) return moveToCharacter(books, pack, name, existing);
    if (step.step === 'refuse') return said(false, step.message);
    if (step.step === 'confirm') return said(false, step.message, { confirm: true });
    let first;
    if (step.step === 'current') first = `${name} is up to date (made from ${pack.name} ${pack.version}).`;
    else {
        try { await books.save(name, book); } catch (error) { return said(false, `${name} was not saved (${reason(error)}).`); }
        first = `${step.update ? 'Updated' : 'Made'} ${name} (${count(counts.entries, 'entry', 'entries')}${counts.hidden ? `; ${count(counts.hidden, 'hidden entry', 'hidden entries')} kept out` : ''}).`;
    }
    const root = settings?.read?.();
    if (root && typeof root === 'object') { root.lorebooks = { ...madeHints(settings), [pack.id]: { name, version: pack.version } }; await settings.save?.(); }
    const extra = step.step === 'current' ? { state: 'current' } : {};
    if (!use) return said(true, first, extra);
    return said(true, `${first} ${(await withCharacter(books, name)).text}`, extra);
}

/** The rows for the installed world packs with lore (the selector's input): `[{ id, ...lorebookRow }]`. */
export function lorebookRows({ list = [], books, settings }) {
    const names = books?.names?.() ?? [];
    const made = madeHints(settings);
    const char = books?.character?.() ?? null;
    const chatBook = books?.chatBook?.() ?? '';
    return list.filter(pack => pack?.kind === 'world' && !pack.problem && (pack.counts?.lore ?? 0) > 0)
        .map(pack => ({ id: String(pack.id), ...lorebookRow({ pack, names, made, char, chatBook }) }));
}
