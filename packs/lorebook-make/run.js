// The job: Create or Update a world pack's lorebook and use it in this chat, told in words: the converter, the book already there (its marker),
// the save through SillyTavern and the chat lorebook, with the hint of what was made kept in the suite's settings (`storySuite.lorebooks`).

import { lorebookFromPack } from './convert.js';
import { lorebookRow, lorebookStep } from './plan.js';

const said = (ok, text, extra = {}) => ({ ok, text, errors: [], ...extra });
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const reason = error => String(error?.message ?? error ?? 'it did not work');

/** The hints kept in the suite's settings: `{ [pack id]: { name, version } }`. */
export function madeHints(settings) {
    const value = settings?.read?.()?.lorebooks;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * `deps` = { packs (installed.js: `get(id)`), books (st-adapter stLorebooks()), settings ({ read, save }) }; `request` = { id, use, confirmed }.
 * → `{ ok, text, errors }`, `confirm: true` with the confirm card's words when the book there is to be replaced and the reader has not said yes,
 * `state: 'current'` when the book is the pack's version already (then only the chat lorebook may change).
 */
export async function makeLorebook({ packs, books, settings }, { id, use = true, confirmed = false } = {}) {
    const pack = packs?.get?.(String(id ?? ''));
    if (!pack || pack.kind !== 'world') return said(false, 'That world pack is not installed.');
    const { name, book, counts } = lorebookFromPack(pack);
    if (!counts.entries) return said(false, `${pack.name} has no lore to put in a lorebook.`);
    let step;
    try {
        const names = await books.refresh();
        step = lorebookStep({ pack, name, existing: names.includes(name) ? await books.load(name) : null, confirmed });
    } catch (error) { return said(false, `The lorebook could not be read from SillyTavern (${reason(error)}).`); }
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
    if (!use) return said(true, first, step.step === 'current' ? { state: 'current' } : {});
    if (books.chatBook() === name) return said(true, `${first} It is this chat’s lorebook.`, step.step === 'current' ? { state: 'current' } : {});
    try { await books.attach(name); } catch (error) { return said(true, `${first} It was not attached to this chat (${reason(error)}).`); }
    return said(true, `${first} Attached to this chat.`, step.step === 'current' ? { state: 'current' } : {});
}

/** The rows for the installed world packs with lore (the selector's input): `[{ id, ...lorebookRow }]`. */
export function lorebookRows({ list = [], books, settings }) {
    const names = books?.names?.() ?? [];
    const made = madeHints(settings);
    const chatBook = books?.chatBook?.() ?? '';
    const hasChat = books?.hasChat?.() ?? false;
    return list.filter(pack => pack?.kind === 'world' && !pack.problem && (pack.counts?.lore ?? 0) > 0)
        .map(pack => ({ id: String(pack.id), ...lorebookRow({ pack, names, made, chatBook, hasChat }) }));
}
