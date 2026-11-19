// The pack lorebook's SillyTavern writer (packs/st-adapter-parts/lorebook-write.js) over a fake SillyTavern: the World Info save read back, the
// chat's character (shallow cards loaded, group chats, no chat), linking through the context's writeExtensionField (the card read back from the
// server), adding through world-info.js charUpdateAddAuxWorld, each checked afterwards, and the chat lorebook never set, only unset when moved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeLorebook } from '../../packs/lorebook-make/run.js';
import { lorebookFromPack } from '../../packs/lorebook-make/convert.js';
import { stLorebooks } from '../../packs/st-adapter.js';
import { fakeSettings } from './helpers/fake-settings.js';

const NAME = 'Tiny World (Story Suite)';
const tiny = () => ({ id: 'tiny', kind: 'world', version: '1.0.0', name: 'Tiny World', content: { lore: [{ title: 'Harbour', keys: ['harbour'], text: 'The harbour.' }] } });
const userBook = { entries: { 0: { uid: 0, comment: 'My own notes', content: 'mine' } } };

// SillyTavern: its context (saveWorldInfo, its list, the server's copy, the chat's metadata and character, writeExtensionField writing the card in
// memory and, unless `keepLink` is false, on the server) and its world-info.js / script.js modules (the Additional lorebooks in world_info.charLore).
function fakeST({ keep = true, chatId = 'chat-1', groupId = null, card = {}, keepLink = true, menu = 'character_edit', oldST = false, chatBook } = {}) {
    const server = {};
    const calls = [];
    const ava = { name: 'Ava', avatar: 'Ava.png', shallow: true, data: { extensions: { world: '', ...(card.world ? { world: card.world } : {}) }, ...(card.book ? { character_book: card.book } : {}) } };
    const ctx = {
        chatMetadata: chatBook ? { world_info: chatBook } : {}, getCurrentChatId: () => chatId, groupId, characterId: '0', characters: [ava], getRequestHeaders: () => ({ 'X-CSRF-Token': 't' }),
        getWorldInfoNames: () => Object.keys(server),
        saveWorldInfo: async (name, data, now) => { calls.push(['save', name, now]); if (keep) server[name] = structuredClone(data); },
        updateWorldInfoList: async () => { calls.push(['list']); },
        loadWorldInfo: async name => server[name] ?? null,
        reloadWorldInfoEditor: name => calls.push(['reload', name]),
        saveMetadata: async () => calls.push(['meta']),
        unshallowCharacter: async id => { calls.push(['unshallow', id]); ava.shallow = false; },
        writeExtensionField: async (id, key, value) => { calls.push(['field', id, key, value]); ctx.characters[id].data.extensions[key] = value; if (keepLink) cards[ava.avatar].data.extensions[key] = value; },
    };
    const cards = { [ava.avatar]: structuredClone({ data: ava.data }) };
    const worldInfo = {
        world_info: { charLore: [] },
        setWorldInfoButtonClass(chid, on) { calls.push(['button', chid, on]); },
        async charUpdateAddAuxWorld(avatar, name) { calls.push(['aux', avatar, name]); const file = avatar.replace(/\.[^/.]+$/, ''); const lore = worldInfo.world_info.charLore; const found = lore.find(item => item.name === file); if (found) found.extraBooks = [...new Set([...found.extraBooks, name])]; else lore.push({ name: file, extraBooks: [name] }); },
    };
    const importer = async path => { if (oldST) throw new Error('not found'); if (path === '/scripts/world-info.js') return worldInfo; if (path === '/script.js') return { menu_type: menu }; throw new Error(path); };
    const answer = (url, body) => (url === '/api/settings/get' ? { world_names: Object.keys(server) } : url === '/api/characters/get' ? structuredClone(cards[body.avatar_url]) : server[body.name] ?? { entries: {} });
    const fetchImpl = async (url, init) => { calls.push(['fetch', url, init.headers['X-CSRF-Token']]); return { ok: true, json: async () => answer(url, JSON.parse(init.body)) }; };
    globalThis.SillyTavern = { getContext: () => ctx };
    return { ctx, ava, calls, worldInfo, server, books: stLorebooks({ fetchImpl, importer }), done: () => { delete globalThis.SillyTavern; delete globalThis.document; } };
}
const run = async (fn, options) => { const st = fakeST(options); try { await fn(st); } finally { st.done(); } };
const make = (st, request) => makeLorebook({ packs: { get: id => (id === 'tiny' ? tiny() : null) }, books: st.books, settings: fakeSettings() }, { id: 'tiny', use: true, ...request });

test('the writer saves through SillyTavern’s own save, refreshes its list and reads the book back; a book it did not keep is a failure', async () => {
    await run(async st => {
        const { name, book } = lorebookFromPack(tiny());
        await st.books.save(name, book);
        assert.deepEqual(st.calls, [['save', NAME, true], ['list'], ['fetch', '/api/worldinfo/get', 't'], ['reload', NAME]]);
        assert.deepEqual(st.books.names(), [NAME]);
    });
    await run(async st => { const { name, book } = lorebookFromPack(tiny()); await assert.rejects(st.books.save(name, book), /did not keep the book/); }, { keep: false });
});

test('the chat’s character: loaded in full when shallow, with its Additional lorebooks; a group chat; no chat', async () => {
    await run(async st => {
        st.worldInfo.world_info.charLore.push({ name: 'Ava', extraBooks: ['Extra'] }, { name: 'Bo', extraBooks: ['Not hers'] });
        assert.deepEqual(await st.books.characterNow(), { name: 'Ava', world: 'Ava lore', embedded: true, extras: ['Extra'], avatar: 'Ava.png', id: '0' });
        assert.deepEqual(st.calls, [['unshallow', '0']]);
        assert.deepEqual(st.books.character().extras, ['Extra']);
    }, { card: { world: 'Ava lore', book: { entries: [] } } });
    await run(async st => assert.deepEqual(await st.books.characterNow(), { group: true }), { groupId: 'g1' });
    await run(async st => assert.equal(await st.books.characterNow(), null), { chatId: null });
});

test('a card with no lorebook: Create links it through writeExtensionField, reads the card back, sets the panel field and ST’s button; the chat lorebook is untouched', async () => {
    await run(async st => {
        const field = { value: '' };
        globalThis.document = { querySelector: selector => (selector === '#avatar_url_pole' ? { value: 'Ava.png' } : selector === '#character_world' ? field : null), querySelectorAll: () => [] };
        const answer = await make(st);
        assert.equal(answer.text, `Made ${NAME} (1 entry). Linked to Ava.`);
        assert.equal(st.ava.data.extensions.world, NAME);
        assert.equal(field.value, NAME);
        assert.deepEqual(st.calls.filter(call => ['field', 'aux', 'meta', 'button'].includes(call[0])), [['field', '0', 'world', NAME], ['button', undefined, true]]);
        assert.ok(st.calls.some(call => call[1] === '/api/characters/get'));
        assert.deepEqual(st.ctx.chatMetadata, { world_info: 'MemoryBook Ava' });
        assert.equal((await make(st)).text, `${NAME} is up to date (made from Tiny World 1.0.0). Linked to Ava.`);
    }, { chatBook: 'MemoryBook Ava' });
});

test('a card with its own lorebook, linked or carried in the card: it is kept, the book is added once to the Additional lorebooks', async () => {
    for (const card of [{ world: 'Ava lore' }, { book: { entries: [{ keys: ['x'], content: 'y' }] } }]) {
        await run(async st => {
            assert.equal((await make(st)).text, `Made ${NAME} (1 entry). Added to Ava’s lorebooks (Ava keeps its own).`);
            assert.equal(st.ava.data.extensions.world, card.world ?? '');
            assert.deepEqual(st.worldInfo.world_info.charLore, [{ name: 'Ava', extraBooks: [NAME] }]);
            await st.books.addExtra(NAME);
            assert.deepEqual(st.calls.filter(call => call[0] === 'aux'), [['aux', 'Ava.png', NAME]]);
        }, { card });
    }
});

test('the link is checked and refused when it cannot be right: not kept, a new card being made, the panel on another card, an older SillyTavern', async () => {
    await run(async st => assert.match((await make(st)).text, /It was not linked to Ava \(SillyTavern did not keep the link\)\.$/), { keepLink: false });
    await run(async st => { await assert.rejects(st.books.link(NAME), /a new character is being made/); assert.equal(st.calls.some(call => call[0] === 'field'), false); }, { menu: 'create' });
    await run(async st => {
        globalThis.document = { querySelector: selector => (selector === '#avatar_url_pole' ? { value: 'Bo.png' } : null), querySelectorAll: () => [] };
        await assert.rejects(st.books.link(NAME), /the character panel shows another character/);
        assert.equal(st.ava.data.extensions.world, '');
    });
    await run(async st => { delete st.ctx.writeExtensionField; await assert.rejects(st.books.link(NAME), /cannot link a lorebook to a character/); await assert.rejects(st.books.addExtra(NAME), /cannot link/); }, { oldST: true });
    await run(async st => assert.match((await make(st)).text, /group chat: pick a character chat/), { groupId: 'g1' });
});

test('Move: this pack’s book as the chat lorebook is linked to the character and the chat lorebook unset (button too); any other chat lorebook is left', async () => {
    await run(async st => {
        await make(st, { use: false });
        st.ctx.chatMetadata.world_info = NAME;
        const button = { classes: new Set(['world_set']), classList: { remove: c => button.classes.delete(c) } };
        globalThis.document = { querySelector: () => null, querySelectorAll: selector => (selector === '.chat_lorebook_button' ? [button] : []) };
        assert.equal((await make(st, { move: true })).text, 'Linked to Ava. It is no longer this chat’s lorebook.');
        assert.deepEqual([st.ava.data.extensions.world, 'world_info' in st.ctx.chatMetadata, button.classes.has('world_set'), st.calls.at(-1)], [NAME, false, false, ['meta']]);
    });
    await run(async st => {
        await make(st, { use: false });
        await st.books.clearChatBook(NAME);
        assert.equal((await make(st, { move: true })).ok, false);
        assert.deepEqual([st.ctx.chatMetadata, st.calls.some(call => call[0] === 'meta' || call[0] === 'field')], [{ world_info: 'MemoryBook Ava' }, false]);
    }, { chatBook: 'MemoryBook Ava' });
});

test('no code path sets the chat lorebook: the writer only reads it and deletes it', () => {
    for (const file of ['packs/st-adapter-parts/lorebook-write.js', 'packs/lorebook-make/run.js', 'packs/lorebook-make/plan.js']) {
        const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
        assert.equal(/\[\s*CHAT_KEY\s*\]\s*=[^=]|\.world_info\s*=[^=]|\[\s*['"]world_info['"]\s*\]\s*=[^=]/.test(source), false, file);
    }
});

test('a SillyTavern whose context cannot list the books: the server’s list is read, so a reader’s own book of that name is still refused', async () => {
    await run(async st => {
        delete st.ctx.getWorldInfoNames;
        st.server[NAME] = structuredClone(userBook);
        assert.deepEqual(await st.books.refresh(), [NAME]);
        const answer = await make(st, { confirmed: true });
        assert.deepEqual([answer.ok, /did not make it/.test(answer.text), st.server[NAME]], [false, true, userBook]);
    });
});
