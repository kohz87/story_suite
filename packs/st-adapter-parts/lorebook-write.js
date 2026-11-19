// The job: a pack lorebook in SillyTavern: the World Info book names, reading and saving a book through SillyTavern's own World Info save, and
// making it this chat's lorebook (the chat-lore button's `chat_metadata.world_info` + saveMetadata). Everything is read when called.

import { readMarker } from '../lorebook-make/marker.js';
import { context } from './shared-context.js';

// The chat's lorebook key in SillyTavern's chat metadata (world-info.js METADATA_KEY).
const CHAT_KEY = 'world_info';
const entryCount = book => Object.keys(book?.entries ?? {}).length;

/**
 * `{ names(), chatBook(), hasChat(), refresh(), load(name), save(name, book), attach(name) }` over SillyTavern; `fetchImpl` is for tests.
 * `save` uses the context's `saveWorldInfo(name, book, true)` (the editor's `/api/worldinfo/edit` with its request headers), then refreshes the world
 * list and reads the book back from the server: SillyTavern's save does not check the answer, so a book that did not arrive is told as a failure.
 */
export function stLorebooks({ fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
    const post = async (url, body) => {
        const ctx = context();
        if (typeof ctx?.getRequestHeaders !== 'function') throw new Error('SillyTavern is not available');
        const response = await fetchImpl(url, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) });
        if (!response?.ok) throw new Error(`the server answered ${response?.status ?? 'nothing'}`);
        return response;
    };
    const fromServer = async name => (await post('/api/worldinfo/get', { name })).json();
    const books = {
        /** SillyTavern's World Info book names as it lists them now. */
        names: () => { const list = context()?.getWorldInfoNames?.(); return Array.isArray(list) ? list.map(String) : []; },
        /** This chat's lorebook ('' for none). */
        chatBook: () => String(context()?.chatMetadata?.[CHAT_KEY] ?? ''),
        hasChat: () => { const ctx = context(); return Boolean(ctx?.getCurrentChatId?.() ?? ctx?.chatId); },
        /** Asks SillyTavern for its book list again (its own World Info list too) → the names. */
        async refresh() {
            const ctx = context();
            if (typeof ctx?.updateWorldInfoList === 'function') { await ctx.updateWorldInfoList(); return books.names(); }
            const settings = await (await post('/api/settings/get', {})).json();
            return Array.isArray(settings?.world_names) ? settings.world_names.map(String) : [];
        },
        /** The book as SillyTavern has it, or null. */
        async load(name) {
            const ctx = context();
            const book = typeof ctx?.loadWorldInfo === 'function' ? await ctx.loadWorldInfo(name) : await fromServer(name);
            return book && typeof book === 'object' ? book : null;
        },
        /** Saves the book and checks the server has it (its marker and entry count); throws with a reason when not. */
        async save(name, book) {
            const ctx = context();
            if (typeof ctx?.saveWorldInfo === 'function') await ctx.saveWorldInfo(name, book, true);
            else await post('/api/worldinfo/edit', { name, data: book });
            const names = await books.refresh();
            const back = await fromServer(name);
            const want = readMarker(book);
            if (!names.includes(name) || entryCount(back) !== entryCount(book) || JSON.stringify(readMarker(back)) !== JSON.stringify(want)) throw new Error('SillyTavern did not keep the book');
            ctx?.reloadWorldInfoEditor?.(name);
        },
        /** Makes the book this chat's lorebook, as the chat-lore button does; throws with a reason when no chat is open. */
        async attach(name) {
            const ctx = context();
            if (!books.hasChat() || !ctx?.chatMetadata || typeof ctx.saveMetadata !== 'function') throw new Error('no chat is open');
            ctx.chatMetadata[CHAT_KEY] = name;
            await ctx.saveMetadata();
            for (const button of globalThis.document?.querySelectorAll?.('.chat_lorebook_button') ?? []) button.classList.add('world_set');
        },
    };
    return books;
}
