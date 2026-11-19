// Settings › Packs: a world pack's lorebook row (Create / Update / Up to date), the Use in this chat tick, the Update question and the result line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { store, world, game } from './packs-v4-helpers.js';
import { pairingView, ownView } from '../../../packs/index-parts/page-queries.js';
import { selectPacks } from '../../../ui/select/packs.js';
import { lorebookRows } from '../../../packs/lorebook-make/run.js';
import { lorebookFromPack } from '../../../packs/lorebook-make/convert.js';
import { packsCommand } from '../../../ui/port/packs.js';
import { fakeSettings } from '../../packs/helpers/fake-settings.js';
import { mountSettings } from './sections/mount.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const NAME = 'Ersveil (Story Suite)';
const LORE = [{ title: 'Bluewatch', keys: ['Bluewatch'], text: 'A village by the water.' }, { title: 'Vault', keys: [], text: 'Sealed.', hidden: true, gate: 'fact:x' }];
const loreWorld = (version = '4.0.0') => world({ version, content: { start: { date: { year: 611, month: 10, day: 1 } }, places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1 }], lore: LORE } });

// SillyTavern's side as the page and the port see it.
function fakeBooks({ files = {}, chatBook = '' } = {}) {
    let chat = chatBook;
    return { files, names: () => Object.keys(files), chatBook: () => chat, hasChat: () => true, refresh: async () => Object.keys(files), load: async name => files[name] ?? null,
        save: async (name, book) => { files[name] = structuredClone(book); }, attach: async name => { chat = name; } };
}

function mountLorebook(installed, books, settings = fakeSettings()) {
    const view = () => ({ packs: selectPacks({ list: installed.list(), setup: [], pairing: pairingView(installed), own: ownView(installed), lorebook: lorebookRows({ list: installed.list(), books, settings }) }), sections: [{ id: 'start', rows: [] }] });
    const sent = [];
    const mounted = mountSettings({ packs: view().packs }, {
        onView: name => (name === 'settings' ? view() : null),
        onChange: () => ({ ok: true }),
        onAction: (key, value) => { sent.push([key, value]); return packsCommand({ packs: installed, lorebooks: { books, settings } }, null, 'settings.action', { key, value }); },
    });
    return { ...mounted, sent, settings };
}
const row = el => el.querySelector('[data-lorebook="ersveil"]');
const click = (el, label) => el.querySelectorAll('button').find(b => b.textContent === label).click();

test('a world with lore gets "Create the lorebook from this pack" with Use in this chat ticked; a game and a world with no lore get none', async () => {
    const books = fakeBooks();
    const { page } = mountLorebook(await store(loreWorld(), game('ersveil-game', 'Ersveil rules')), books);
    const el = page('packs');
    assert.equal(el.querySelectorAll('.lbook').length, 1);
    assert.ok(row(el).textContent.includes('Create the lorebook from this pack'));
    assert.equal(row(el).querySelector('input[type="checkbox"]').checked, true);
    const bare = mountLorebook(await store(world()), fakeBooks()).page('packs');
    assert.equal(bare.querySelectorAll('.lbook').length, 0);
});

test('Create: the port makes the book, attaches it and the result line says so; the row then reads Up to date', async () => {
    const books = fakeBooks();
    const { page, sent } = mountLorebook(await store(loreWorld()), books);
    click(row(page('packs')), 'Create the lorebook from this pack');
    await tick(); await tick();
    assert.deepEqual(sent, [['packs.lorebook.make', { id: 'ersveil', use: true, confirmed: false }]]);
    assert.equal(books.chatBook(), NAME);
    const el = page('packs');
    assert.ok(el.textContent.includes(`Made ${NAME} (1 entry; 1 hidden entry kept out). Attached to this chat.`));
    assert.ok(row(el).textContent.includes('Up to date'));
    assert.ok(row(el).textContent.includes('It is this chat’s lorebook.'));
});

test('a chat with another lorebook: the tick starts off with a line saying why, and Create leaves that lorebook', async () => {
    const books = fakeBooks({ chatBook: 'Campaign notes' });
    const { page, sent } = mountLorebook(await store(loreWorld()), books);
    const el = page('packs');
    assert.equal(row(el).querySelector('input[type="checkbox"]').checked, false);
    assert.ok(row(el).textContent.includes('This chat already uses the lorebook Campaign notes'));
    click(row(el), 'Create the lorebook from this pack');
    await tick(); await tick();
    assert.equal(sent[0][1].use, false);
    assert.equal(books.chatBook(), 'Campaign notes');
});

test('Update asks first ("This replaces the book …; edits you made in it are lost."), Keep it sends nothing, Update sends confirmed', async () => {
    const books = fakeBooks({ files: { [NAME]: lorebookFromPack(loreWorld('3.9.0')).book } });
    const installed = await store(loreWorld());
    const { page, sent } = mountLorebook(installed, books, fakeSettings({ lorebooks: { ersveil: { name: NAME, version: '3.9.0' } } }));
    let el = page('packs');
    assert.ok(row(el).textContent.includes('made from 3.9.0'));
    click(row(el), 'Update the lorebook');
    el = page('packs');
    assert.ok(el.querySelector('.cfm').textContent.includes(`This replaces the book ${NAME}; edits you made in it are lost.`));
    click(el.querySelector('.cfm'), 'Keep it');
    assert.equal(page('packs').querySelector('.cfm'), null);
    assert.deepEqual(sent, []);
    click(row(page('packs')), 'Update the lorebook');
    click(page('packs').querySelector('.cfm'), 'Update');
    await tick(); await tick();
    assert.deepEqual(sent, [['packs.lorebook.make', { id: 'ersveil', use: true, confirmed: true }]]);
    assert.ok(page('packs').textContent.includes(`Updated ${NAME}`));
});

test('a Create that finds an older marker book (made elsewhere after the page was drawn) opens the Update question instead of writing', async () => {
    const books = fakeBooks();
    const { page, sent } = mountLorebook(await store(loreWorld()), books);
    const el = page('packs');
    books.files[NAME] = lorebookFromPack(loreWorld('3.0.0')).book;
    const before = JSON.stringify(books.files[NAME]);
    click(row(el), 'Create the lorebook from this pack');
    await tick(); await tick();
    assert.equal(JSON.stringify(books.files[NAME]), before);
    assert.ok(page('packs').querySelector('.cfm').textContent.includes('edits you made in it are lost'));
    click(page('packs').querySelector('.cfm'), 'Update');
    await tick(); await tick();
    assert.deepEqual(sent.map(([, value]) => value.confirmed), [false, true]);
    assert.notEqual(JSON.stringify(books.files[NAME]), before);
});

test('an up-to-date book on a chat with another lorebook: the line names that lorebook, and Use in this chat attaches without saving', async () => {
    const books = fakeBooks({ files: { [NAME]: lorebookFromPack(loreWorld()).book }, chatBook: 'Campaign notes' });
    const { page, sent } = mountLorebook(await store(loreWorld()), books, fakeSettings({ lorebooks: { ersveil: { name: NAME, version: '4.0.0' } } }));
    const el = page('packs');
    assert.ok(row(el).textContent.includes('Up to date'));
    assert.ok(row(el).textContent.includes('This chat already uses the lorebook Campaign notes; Use in this chat puts this one in its place.'));
    assert.equal(row(el).querySelector('input[type="checkbox"]'), null);
    const saved = JSON.stringify(books.files[NAME]);
    click(row(el), 'Use in this chat');
    await tick(); await tick();
    assert.deepEqual(sent, [['packs.lorebook.make', { id: 'ersveil', use: true, confirmed: false }]]);
    assert.equal(books.chatBook(), NAME);
    assert.equal(JSON.stringify(books.files[NAME]), saved);
    assert.ok(page('packs').textContent.includes(`${NAME} is up to date (made from Ersveil 4.0.0). Attached to this chat.`));
});
