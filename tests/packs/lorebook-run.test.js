// A world pack's lorebook made in SillyTavern (packs/lorebook-make plan + run, packs/st-adapter-parts/lorebook-write): what the row offers, the marker
// deciding Create / Update / refuse, the confirm, the hint, the chat lorebook, and SillyTavern's save checked by reading the book back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lorebookRow, lorebookStep } from '../../packs/lorebook-make/plan.js';
import { makeLorebook, lorebookRows } from '../../packs/lorebook-make/run.js';
import { lorebookFromPack } from '../../packs/lorebook-make/convert.js';
import { stLorebooks } from '../../packs/st-adapter.js';
import { fakeSettings } from './helpers/fake-settings.js';

const NAME = 'Tiny World (Story Suite)';
const tiny = (version = '1.0.0', extra = {}) => ({ id: 'tiny', kind: 'world', version, name: 'Tiny World', content: { lore: [{ title: 'Harbour', keys: ['harbour'], text: 'The harbour.' }, { title: 'Vault', keys: [], text: 'Sealed.', hidden: true, gate: 'fact:x' }] }, ...extra });
const userBook = { entries: { 0: { uid: 0, comment: 'My own notes', content: 'mine' } } };

// SillyTavern as the run sees it: book files by name, this chat's lorebook, and what was saved and attached.
function fakeBooks({ files = {}, chatBook = '', hasChat = true, saveFails = false } = {}) {
    const calls = { saves: [], attached: [] };
    let chat = chatBook;
    const books = {
        names: () => Object.keys(files), chatBook: () => chat, hasChat: () => hasChat,
        refresh: async () => Object.keys(files), load: async name => files[name] ?? null,
        save: async (name, book) => { if (saveFails) throw new Error('the server answered 500'); calls.saves.push(name); files[name] = structuredClone(book); },
        attach: async name => { if (!hasChat) throw new Error('no chat is open'); calls.attached.push(name); chat = name; },
    };
    return { books, calls, files };
}
const packsOf = (...packs) => ({ get: id => packs.find(pack => pack.id === id) ?? null });

test('the row: Create, Update with the version it was made from, Up to date; the hint alone never says Update without the book', () => {
    const pack = { id: 'tiny', name: 'Tiny World', version: '1.1.0' };
    assert.equal(lorebookRow({ pack }).state, 'create');
    assert.equal(lorebookRow({ pack, made: { tiny: { name: NAME, version: '1.0.0' } } }).state, 'create');
    assert.deepEqual([lorebookRow({ pack, names: [NAME], made: { tiny: { name: NAME, version: '1.0.0' } } })].map(row => [row.state, row.madeFrom]), [['update', '1.0.0']]);
    assert.equal(lorebookRow({ pack, names: [NAME], made: { tiny: { name: NAME, version: '1.1.0' } } }).state, 'current');
    assert.deepEqual([lorebookRow({ pack, names: [NAME] })].map(row => [row.state, row.madeFrom]), [['update', '']]);
});

test('the Use in this chat tick: on by default, off with a line when the chat has another lorebook, off and locked with no chat', () => {
    const pack = { id: 'tiny', name: 'Tiny World', version: '1.0.0' };
    assert.deepEqual(lorebookRow({ pack }).use, { on: true, disabled: false, note: '' });
    const other = lorebookRow({ pack, chatBook: 'Campaign notes' }).use;
    assert.equal(other.on, false);
    assert.match(other.note, /already uses the lorebook Campaign notes/);
    assert.equal(lorebookRow({ pack, names: [NAME], chatBook: NAME }).attached, true);
    assert.deepEqual(lorebookRow({ pack, hasChat: false }).use, { on: false, disabled: true, note: 'Open a chat to use the lorebook in it.' });
});

test('the step: a book of that name the suite did not make, or made from another pack, is never written over', () => {
    const pack = tiny('1.1.0');
    const made = version => lorebookFromPack(tiny(version)).book;
    assert.equal(lorebookStep({ pack, name: NAME }).step, 'write');
    assert.match(lorebookStep({ pack, name: NAME, existing: userBook }).message, /Story Suite did not make it/);
    assert.equal(lorebookStep({ pack, name: NAME, existing: lorebookFromPack({ ...tiny(), id: 'other' }).book }).step, 'refuse');
    assert.equal(lorebookStep({ pack, name: NAME, existing: made('1.1.0') }).step, 'current');
    assert.deepEqual(lorebookStep({ pack, name: NAME, existing: made('1.0.0') }), { step: 'confirm', update: true, message: `This replaces the book ${NAME}; edits you made in it are lost.` });
    assert.equal(lorebookStep({ pack, name: NAME, existing: made('1.0.0'), confirmed: true }).step, 'write');
});

test('Create: the book is saved, attached to this chat and remembered; the line counts the hidden entries kept out', async () => {
    const st = fakeBooks();
    const settings = fakeSettings();
    const answer = await makeLorebook({ packs: packsOf(tiny()), books: st.books, settings }, { id: 'tiny', use: true });
    assert.deepEqual(answer, { ok: true, text: `Made ${NAME} (1 entry; 1 hidden entry kept out). Attached to this chat.`, errors: [] });
    assert.deepEqual(st.calls, { saves: [NAME], attached: [NAME] });
    assert.deepEqual(settings.root.lorebooks, { tiny: { name: NAME, version: '1.0.0' } });
    assert.equal(JSON.stringify(st.files[NAME]).includes('Sealed'), false);
});

test('Use in this chat off: made, the chat lorebook left alone', async () => {
    const st = fakeBooks({ chatBook: 'Campaign notes' });
    const answer = await makeLorebook({ packs: packsOf(tiny()), books: st.books, settings: fakeSettings() }, { id: 'tiny', use: false });
    assert.equal(answer.text, `Made ${NAME} (1 entry; 1 hidden entry kept out).`);
    assert.deepEqual(st.calls.attached, []);
    assert.equal(st.books.chatBook(), 'Campaign notes');
});

test('Update: asks first, then replaces only the marker book; the same version again is Up to date and saves nothing', async () => {
    const st = fakeBooks({ files: { [NAME]: lorebookFromPack(tiny('1.0.0')).book } });
    const deps = { packs: packsOf(tiny('1.1.0')), books: st.books, settings: fakeSettings() };
    const asked = await makeLorebook(deps, { id: 'tiny', use: true });
    assert.equal(asked.ok, false);
    assert.equal(asked.confirm, true);
    assert.deepEqual(st.calls.saves, []);
    const done = await makeLorebook(deps, { id: 'tiny', use: true, confirmed: true });
    assert.match(done.text, /^Updated Tiny World \(Story Suite\) \(1 entry; 1 hidden entry kept out\)\. Attached to this chat\.$/);
    const again = await makeLorebook(deps, { id: 'tiny', use: true, confirmed: true });
    assert.equal(again.state, 'current');
    assert.equal(again.text, `${NAME} is up to date (made from Tiny World 1.1.0). It is this chat’s lorebook.`);
    assert.deepEqual(st.calls.saves, [NAME]);
});

test('refusals: a user book of that name, a pack not installed or with no lore, a failed save, no chat to attach to', async () => {
    const mine = fakeBooks({ files: { [NAME]: userBook } });
    const refused = await makeLorebook({ packs: packsOf(tiny()), books: mine.books, settings: fakeSettings() }, { id: 'tiny', confirmed: true });
    assert.equal(refused.ok, false);
    assert.match(refused.text, /did not make it/);
    assert.deepEqual(mine.files[NAME], userBook);
    assert.equal((await makeLorebook({ packs: packsOf(), books: mine.books }, { id: 'tiny' })).text, 'That world pack is not installed.');
    assert.match((await makeLorebook({ packs: packsOf(tiny('1.0.0', { content: { lore: [] } })), books: mine.books }, { id: 'tiny' })).text, /has no lore/);
    const failing = fakeBooks({ saveFails: true });
    assert.match((await makeLorebook({ packs: packsOf(tiny()), books: failing.books }, { id: 'tiny' })).text, /was not saved \(the server answered 500\)/);
    const noChat = fakeBooks({ hasChat: false });
    const made = await makeLorebook({ packs: packsOf(tiny()), books: noChat.books }, { id: 'tiny', use: true });
    assert.equal(made.ok, true);
    assert.match(made.text, /It was not attached to this chat \(no chat is open\)\.$/);
});

test('rows: only installed world packs that check and have lore', () => {
    const st = fakeBooks();
    const rows = lorebookRows({ list: [{ id: 'tiny', kind: 'world', name: 'Tiny World', version: '1.0.0', counts: { lore: 2 } }, { id: 'g', kind: 'game', name: 'G', counts: {} }, { id: 'bare', kind: 'world', name: 'Bare', counts: {} }, { id: 'bad', kind: 'world', problem: 'x', counts: { lore: 1 } }], books: st.books, settings: fakeSettings() });
    assert.deepEqual(rows.map(row => [row.id, row.state, row.name]), [['tiny', 'create', NAME]]);
});

// SillyTavern's context for the writer: saveWorldInfo, its list, the server's copy, the chat's metadata.
function fakeContext({ keep = true, chatId = 'chat-1' } = {}) {
    const server = {};
    const calls = [];
    const ctx = {
        chatMetadata: {}, getCurrentChatId: () => chatId, getRequestHeaders: () => ({ 'X-CSRF-Token': 't' }),
        getWorldInfoNames: () => Object.keys(server),
        saveWorldInfo: async (name, data, now) => { calls.push(['save', name, now]); if (keep) server[name] = structuredClone(data); },
        updateWorldInfoList: async () => { calls.push(['list']); },
        loadWorldInfo: async name => server[name] ?? null,
        reloadWorldInfoEditor: name => calls.push(['reload', name]),
        saveMetadata: async () => calls.push(['meta']),
    };
    const fetchImpl = async (url, init) => { calls.push(['fetch', url, init.headers['X-CSRF-Token']]); return { ok: true, json: async () => server[JSON.parse(init.body).name] ?? { entries: {} } }; };
    globalThis.SillyTavern = { getContext: () => ctx };
    return { ctx, calls, fetchImpl, server, done: () => { delete globalThis.SillyTavern; } };
}

test('the writer saves through SillyTavern’s own save, refreshes its list, reads the book back, then attaches it as the chat lorebook', async () => {
    const st = fakeContext();
    try {
        const books = stLorebooks({ fetchImpl: st.fetchImpl });
        const { name, book } = lorebookFromPack(tiny());
        await books.save(name, book);
        assert.deepEqual(st.calls, [['save', NAME, true], ['list'], ['fetch', '/api/worldinfo/get', 't'], ['reload', NAME]]);
        assert.deepEqual(books.names(), [NAME]);
        await books.attach(name);
        assert.equal(st.ctx.chatMetadata.world_info, NAME);
        assert.equal(books.chatBook(), NAME);
        assert.deepEqual(st.calls.at(-1), ['meta']);
    } finally { st.done(); }
});

test('the writer tells a save SillyTavern did not keep, and refuses to attach with no chat open', async () => {
    const lost = fakeContext({ keep: false, chatId: null });
    try {
        const books = stLorebooks({ fetchImpl: lost.fetchImpl });
        const { name, book } = lorebookFromPack(tiny());
        await assert.rejects(books.save(name, book), /did not keep the book/);
        await assert.rejects(books.attach(name), /no chat is open/);
        assert.equal(lost.ctx.chatMetadata.world_info, undefined);
    } finally { lost.done(); }
});
