// Settings › Packs: a world pack's lorebook row (Create / Update / Up to date), the Use with this character tick and its lines, the Move line for a
// book an earlier version made this chat's lorebook, the Update question and the result line.
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
const AVA = { name: 'Ava', world: '', embedded: false, extras: [] };
const MADE = version => fakeSettings({ lorebooks: { ersveil: { name: NAME, version } } });

// SillyTavern's side as the page and the port see it: the books, this chat's lorebook, the chat's character.
function fakeBooks({ files = {}, chatBook = '', char = AVA } = {}) {
    let chat = chatBook;
    const who = char ? structuredClone(char) : null;
    return { files, who, names: () => Object.keys(files), chatBook: () => chat, character: () => who, characterNow: async () => who, refresh: async () => Object.keys(files), load: async name => files[name] ?? null,
        save: async (name, book) => { files[name] = structuredClone(book); }, link: async name => { who.world = name; }, addExtra: async name => { who.extras = [...who.extras, name]; },
        clearChatBook: async name => { if (chat === name) chat = ''; } };
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

test('a world with lore gets "Create the lorebook from this pack" with Use with this character ticked; a game and a world with no lore get none', async () => {
    const books = fakeBooks();
    const { page } = mountLorebook(await store(loreWorld(), game('ersveil-game', 'Ersveil rules')), books);
    const el = page('packs');
    assert.equal(el.querySelectorAll('.lbook').length, 1);
    assert.ok(row(el).textContent.includes('Create the lorebook from this pack'));
    assert.ok(row(el).querySelector('label.lbtick').textContent.includes('Use with this character'));
    assert.equal(row(el).querySelector('input[type="checkbox"]').checked, true);
    const bare = mountLorebook(await store(world()), fakeBooks()).page('packs');
    assert.equal(bare.querySelectorAll('.lbook').length, 0);
});

test('Create on a card with no lorebook: the port makes the book and links it; the row then reads Up to date and Linked to Ava; the chat lorebook is left', async () => {
    const books = fakeBooks({ chatBook: 'MemoryBook Ava' });
    const { page, sent } = mountLorebook(await store(loreWorld()), books);
    click(row(page('packs')), 'Create the lorebook from this pack');
    await tick(); await tick();
    assert.deepEqual(sent, [['packs.lorebook.make', { id: 'ersveil', use: true, confirmed: false }]]);
    assert.deepEqual([books.who.world, books.chatBook()], [NAME, 'MemoryBook Ava']);
    const el = page('packs');
    assert.ok(el.textContent.includes(`Made ${NAME} (1 entry; 1 hidden entry kept out). Linked to Ava.`));
    assert.ok(row(el).textContent.includes('Up to date'));
    assert.ok(row(el).textContent.includes('Linked to Ava.'));
    assert.equal(row(el).querySelectorAll('button').some(b => b.textContent === 'Use with this character'), false);
    assert.equal(row(el).querySelector('.lbmove'), null);
});

test('a card with its own lorebook: the tick stays on with a line saying it is kept, and Create adds the book beside it', async () => {
    const books = fakeBooks({ char: { ...AVA, world: 'Ava lore' } });
    const { page } = mountLorebook(await store(loreWorld()), books);
    const el = page('packs');
    assert.equal(row(el).querySelector('input[type="checkbox"]').checked, true);
    assert.ok(row(el).textContent.includes('Ava has its own lorebook (Ava lore); this one is added beside it.'));
    click(row(el), 'Create the lorebook from this pack');
    await tick(); await tick();
    assert.ok(page('packs').textContent.includes('Added to Ava’s lorebooks (Ava keeps its own).'));
    assert.deepEqual([books.who.world, books.who.extras], ['Ava lore', [NAME]]);
});

test('no character chat, or a group chat: the tick is off and locked with a line saying why, and Create only makes the book', async () => {
    const group = fakeBooks({ char: { group: true } });
    const { page, sent } = mountLorebook(await store(loreWorld()), group);
    const el = page('packs');
    const box = row(el).querySelector('input[type="checkbox"]');
    assert.deepEqual([box.checked, box.hasAttribute('disabled')], [false, true]);
    assert.ok(row(el).textContent.includes('This is a group chat: pick a character chat to use the lorebook with that character.'));
    click(row(el), 'Create the lorebook from this pack');
    await tick(); await tick();
    assert.equal(sent[0][1].use, false);
    assert.ok(page('packs').textContent.includes(`Made ${NAME} (1 entry; 1 hidden entry kept out).`));
    const none = mountLorebook(await store(loreWorld()), fakeBooks({ char: null })).page('packs');
    assert.ok(row(none).textContent.includes('Open a character chat to use the lorebook with that character.'));
});

test('Update asks first ("This replaces the book …; edits you made in it are lost."), Keep it sends nothing, Update sends confirmed', async () => {
    const books = fakeBooks({ files: { [NAME]: lorebookFromPack(loreWorld('3.9.0')).book } });
    const { page, sent } = mountLorebook(await store(loreWorld()), books, MADE('3.9.0'));
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

test('an up-to-date book not with the character: Use with this character links it without saving', async () => {
    const books = fakeBooks({ files: { [NAME]: lorebookFromPack(loreWorld()).book } });
    const { page, sent } = mountLorebook(await store(loreWorld()), books, MADE('4.0.0'));
    const el = page('packs');
    assert.ok(row(el).textContent.includes('Up to date'));
    assert.equal(row(el).querySelector('input[type="checkbox"]'), null);
    const saved = JSON.stringify(books.files[NAME]);
    click(row(el), 'Use with this character');
    await tick(); await tick();
    assert.deepEqual(sent, [['packs.lorebook.make', { id: 'ersveil', use: true, confirmed: false }]]);
    assert.deepEqual([books.who.world, JSON.stringify(books.files[NAME])], [NAME, saved]);
    assert.ok(page('packs').textContent.includes(`${NAME} is up to date (made from Ersveil 4.0.0). Linked to Ava.`));
});

test('a chat whose lorebook is this pack’s book (drop 7): the Move line links it to the character and empties the chat lorebook; another chat lorebook gets no Move', async () => {
    const files = { [NAME]: lorebookFromPack(loreWorld()).book };
    const books = fakeBooks({ files, chatBook: NAME });
    const { page, sent } = mountLorebook(await store(loreWorld()), books, MADE('4.0.0'));
    click(row(page('packs')).querySelector('.lbmove'), 'Move it from this chat to the character');
    await tick(); await tick();
    assert.deepEqual(sent, [['packs.lorebook.make', { id: 'ersveil', use: true, move: true }]]);
    assert.deepEqual([books.who.world, books.chatBook()], [NAME, '']);
    const el = page('packs');
    assert.ok(el.textContent.includes('Linked to Ava. It is no longer this chat’s lorebook.'));
    assert.equal(row(el).querySelector('.lbmove'), null);
    const other = mountLorebook(await store(loreWorld()), fakeBooks({ files, chatBook: 'MemoryBook Ava' }), MADE('4.0.0')).page('packs');
    assert.equal(row(other).querySelector('.lbmove'), null);
});

test('the Packs view-model with a lorebook row keeps the settings contract', async () => {
    const { checkShape } = await import('../../../ui/contract/shapes.js');
    const { SETTINGS_SHAPE } = await import('../../../ui/contract/settings.js');
    const { buildSettings } = await import('../../../ui/fixtures/settings.js');
    const installed = await store(loreWorld());
    const packs = selectPacks({ list: installed.list(), setup: [], pairing: pairingView(installed), own: ownView(installed), lorebook: lorebookRows({ list: installed.list(), books: fakeBooks({ chatBook: 'MemoryBook Ava' }), settings: fakeSettings() }) });
    assert.equal(packs.v4.installed[0].lorebook.state, 'create');
    assert.deepEqual(checkShape({ ...buildSettings(), packs }, SETTINGS_SHAPE), []);
});
