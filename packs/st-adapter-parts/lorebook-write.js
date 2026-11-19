// The job: a pack lorebook in SillyTavern: the World Info book names, reading and saving a book through SillyTavern's own World Info save, and
// using it with the chat's character as SillyTavern's own code does: the card's linked lorebook (`data.extensions.world`) through the context's
// writeExtensionField (the merge-attributes save SillyTavern's lorebook rename uses for that field; the dialog's full card save would also
// remake the greeting of an untouched chat, and with it the story's opening record), and the character's Additional lorebooks through
// world-info.js charUpdateAddAuxWorld (world_info.charLore). The chat lorebook (`chat_metadata.world_info`) is never set: it is only read, and
// unset when it is this pack's own book being moved to the character.

import { readMarker } from '../lorebook-make/marker.js';
import { context } from './shared-context.js';

// The chat's lorebook key in SillyTavern's chat metadata (world-info.js METADATA_KEY), and SillyTavern's own modules (the page's, by their URL).
const CHAT_KEY = 'world_info';
const WORLD_INFO = '/scripts/world-info.js';
const MAIN = '/script.js';
const OLD = 'this SillyTavern cannot link a lorebook to a character; link it in the character’s World Info';
const entryCount = book => Object.keys(book?.entries ?? {}).length;
const fileOf = avatar => String(avatar ?? '').replace(/\.[^/.]+$/, '');
const inGroup = ctx => ctx?.groupId !== undefined && ctx?.groupId !== null && ctx?.groupId !== '';

/**
 * `{ names(), chatBook(), hasChat(), character(), characterNow(), refresh(), load(name), save(name, book), link(name), addExtra(name),
 * clearChatBook(name) }` over SillyTavern; `fetchImpl` and `importer` (SillyTavern's modules) are for tests.
 * `save` uses the context's `saveWorldInfo(name, book, true)` (the editor's `/api/worldinfo/edit` with its request headers), then refreshes the world
 * list and reads the book back from the server: SillyTavern's save does not check the answer, so a book that did not arrive is told as a failure.
 * `link` and `addExtra` check the same way: the card as the server has it, or charLore as SillyTavern has it afterwards.
 */
export function stLorebooks({ fetchImpl = (...args) => globalThis.fetch(...args), importer = path => import(path) } = {}) {
    let loading = null;
    let worldInfo = null;
    const loadWorldInfo = () => (loading ??= Promise.resolve().then(() => importer(WORLD_INFO)).then(mod => (worldInfo = mod), error => { loading = null; throw error; }));
    // (on a SillyTavern page its World Info module is read now, so the row knows the Additional lorebooks when Settings is first drawn)
    if (context()) loadWorldInfo().catch(() => {});
    const post = async (url, body) => {
        const ctx = context();
        if (typeof ctx?.getRequestHeaders !== 'function') throw new Error('SillyTavern is not available');
        const response = await fetchImpl(url, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) });
        if (!response?.ok) throw new Error(`the server answered ${response?.status ?? 'nothing'}`);
        return response;
    };
    const fromServer = async name => (await post('/api/worldinfo/get', { name })).json();
    const extrasOf = (mod, avatar) => {
        const found = (Array.isArray(mod?.world_info?.charLore) ? mod.world_info.charLore : []).find(item => item?.name === fileOf(avatar));
        return Array.isArray(found?.extraBooks) ? found.extraBooks.map(String) : [];
    };
    // The chat's character for plan.js characterStep (null: no character chat; `{ group }`), with its avatar and index for the writes.
    const snapshot = (ctx, extras) => {
        if (!books.hasChat()) return null;
        if (inGroup(ctx)) return { group: true };
        const char = ctx?.characters?.[ctx?.characterId];
        if (!char) return null;
        return { name: String(char.name ?? char.data?.name ?? ''), world: String(char.data?.extensions?.world ?? ''), embedded: Boolean(char.data?.character_book), extras, avatar: char.avatar, id: ctx.characterId };
    };
    // Refused while a new character is being made (its form would take the book) or when the character panel holds another card than the chat's
    // (the panel's hidden World field, which the next card save sends, is set to the book).
    const ready = async now => {
        const main = await Promise.resolve().then(() => importer(MAIN)).catch(() => null);
        if (main?.menu_type === 'create') throw new Error('a new character is being made; finish or close it first');
        const form = globalThis.document?.querySelector?.('#avatar_url_pole')?.value;
        if (typeof form === 'string' && form !== now.avatar) throw new Error('the character panel shows another character');
    };
    const character = () => {
        const now = snapshot(context(), null);
        if (now?.avatar === undefined) return now;
        if (!worldInfo) { loadWorldInfo().catch(() => {}); return now; }
        return { ...now, extras: extrasOf(worldInfo, now.avatar) };
    };
    const books = {
        /** SillyTavern's World Info book names as it lists them now. */
        names: () => { const list = context()?.getWorldInfoNames?.(); return Array.isArray(list) ? list.map(String) : []; },
        /** This chat's lorebook ('' for none); read only. */
        chatBook: () => String(context()?.chatMetadata?.[CHAT_KEY] ?? ''),
        hasChat: () => { const ctx = context(); return Boolean(ctx?.getCurrentChatId?.() ?? ctx?.chatId); },
        /** The chat's character as the row sees it now (its Additional lorebooks null until SillyTavern's World Info module is loaded). */
        character,
        /** The chat's character in full (a shallow card is loaded first) with its Additional lorebooks, for deciding when the button is pressed. */
        async characterNow() {
            const ctx = context();
            const first = snapshot(ctx, null);
            if (first?.avatar === undefined) return first;
            await ctx.unshallowCharacter?.(first.id);
            const mod = await loadWorldInfo().catch(() => null);
            const now = snapshot(context(), null);
            return now?.avatar === undefined ? now : { ...now, extras: mod ? extrasOf(mod, now.avatar) : [] };
        },
        /** Asks SillyTavern for its book list again (its own World Info list too) → the names. */
        async refresh() {
            const ctx = context();
            if (typeof ctx?.updateWorldInfoList === 'function') await ctx.updateWorldInfoList();
            loadWorldInfo().catch(() => {});
            // (a SillyTavern whose context cannot list the books is asked the server's list: an empty list would hide a reader's own book of that name)
            if (typeof ctx?.getWorldInfoNames === 'function') return books.names();
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
        /** Links the book as the card's lorebook (`data.extensions.world`, written to the card file by SillyTavern) and reads the card back. */
        async link(name) {
            const ctx = context();
            const now = snapshot(ctx, null);
            if (now?.avatar === undefined) throw new Error('no character chat is open');
            if (typeof ctx.writeExtensionField !== 'function') throw new Error(OLD);
            await ready(now);
            await ctx.writeExtensionField(now.id, 'world', name);
            const card = await (await post('/api/characters/get', { avatar_url: now.avatar })).json();
            if (String(card?.data?.extensions?.world ?? '') !== name) throw new Error('SillyTavern did not keep the link');
            const field = globalThis.document?.querySelector?.('#character_world');
            if (field) field.value = name;
            const mod = await loadWorldInfo().catch(() => null);
            if (typeof mod?.setWorldInfoButtonClass === 'function') mod.setWorldInfoButtonClass(undefined, true);
        },
        /** Adds the book to the character's Additional lorebooks, as the dialog's Additional pick does (SillyTavern saves its settings). */
        async addExtra(name) {
            const now = snapshot(context(), null);
            if (now?.avatar === undefined) throw new Error('no character chat is open');
            const mod = await loadWorldInfo().catch(() => null);
            if (typeof mod?.charUpdateAddAuxWorld !== 'function') throw new Error(OLD);
            await ready(now);
            if (!extrasOf(mod, now.avatar).includes(name)) await mod.charUpdateAddAuxWorld(now.avatar, name);
            if (!extrasOf(mod, now.avatar).includes(name)) throw new Error('SillyTavern did not keep it');
        },
        /** Unsets this chat's lorebook only when it is `name` (as the chat-lore dialog's None does); any other chat lorebook is left as it is. */
        async clearChatBook(name) {
            const ctx = context();
            if (!name || ctx?.chatMetadata?.[CHAT_KEY] !== name) return;
            if (typeof ctx.saveMetadata !== 'function') throw new Error('this chat cannot be saved');
            delete ctx.chatMetadata[CHAT_KEY];
            await ctx.saveMetadata();
            for (const button of globalThis.document?.querySelectorAll?.('.chat_lorebook_button') ?? []) button.classList.remove('world_set');
        },
    };
    return books;
}
