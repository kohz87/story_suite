// A world pack's lorebook made in SillyTavern (packs/lorebook-make plan + run): what the row offers, the marker deciding Create / Update / refuse,
// the confirm, the hint, and the book with the chat's character (linked when the card has no lorebook, added beside the card's own), never the chat
// lorebook, which is only unset when it is this pack's own book moved to the character.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LOREBOOK_FORMAT } from '../../packs/lorebook-make/convert.js';
import { characterStep, lorebookRow, lorebookStep } from '../../packs/lorebook-make/plan.js';
import { makeLorebook, lorebookRows } from '../../packs/lorebook-make/run.js';
import { lorebookFromPack } from '../../packs/lorebook-make/convert.js';
import { fakeSettings } from './helpers/fake-settings.js';

const NAME = 'Tiny World (Story Suite)';
const tiny = (version = '1.0.0', extra = {}) => ({ id: 'tiny', kind: 'world', version, name: 'Tiny World', content: { lore: [{ title: 'Harbour', keys: ['harbour'], text: 'The harbour.' }, { title: 'Vault', keys: [], text: 'Sealed.', hidden: true, gate: 'fact:x' }] }, ...extra });
const userBook = { entries: { 0: { uid: 0, comment: 'My own notes', content: 'mine' } } };
const AVA = { name: 'Ava', world: '', embedded: false, extras: [] };

// SillyTavern as the run sees it: book files by name, this chat's lorebook, the chat's character, and what was saved, linked, added and unset.
function fakeBooks({ files = {}, chatBook = '', char = AVA, saveFails = false, linkFails = false } = {}) {
    const calls = { saves: [], linked: [], added: [], cleared: [] };
    let chat = chatBook;
    const who = char ? structuredClone(char) : null;
    const books = {
        names: () => Object.keys(files), chatBook: () => chat, character: () => who, characterNow: async () => who,
        refresh: async () => Object.keys(files), load: async name => files[name] ?? null,
        save: async (name, book) => { if (saveFails) throw new Error('the server answered 500'); calls.saves.push(name); files[name] = structuredClone(book); },
        link: async name => { if (linkFails) throw new Error('SillyTavern did not keep the link'); calls.linked.push(name); who.world = name; },
        addExtra: async name => { calls.added.push(name); who.extras = [...who.extras, name]; },
        clearChatBook: async name => { if (chat === name) { calls.cleared.push(name); chat = ''; } },
    };
    return { books, calls, files, who };
}
const packsOf = (...packs) => ({ get: id => packs.find(pack => pack.id === id) ?? null });
const deps = (st, ...packs) => ({ packs: packsOf(...(packs.length ? packs : [tiny()])), books: st.books, settings: fakeSettings() });

test('the row: Create, Update with the version it was made from, Up to date; the hint alone never says Update without the book', () => {
    const pack = { id: 'tiny', name: 'Tiny World', version: '1.1.0' };
    assert.equal(lorebookRow({ pack }).state, 'create');
    assert.equal(lorebookRow({ pack, made: { tiny: { name: NAME, version: '1.0.0' } } }).state, 'create');
    assert.deepEqual([lorebookRow({ pack, names: [NAME], made: { tiny: { name: NAME, version: '1.0.0' } } })].map(row => [row.state, row.madeFrom]), [['update', '1.0.0']]);
    assert.equal(lorebookRow({ pack, names: [NAME], made: { tiny: { name: NAME, version: '1.1.0', format: LOREBOOK_FORMAT } } }).state, 'current');
    // (the same version made with the older placement, before keyed lore went to depth 0: Update)
    assert.equal(lorebookRow({ pack, names: [NAME], made: { tiny: { name: NAME, version: '1.1.0' } } }).state, 'update');
    assert.deepEqual([lorebookRow({ pack, names: [NAME] })].map(row => [row.state, row.madeFrom]), [['update', '']]);
});

test('the decision table: link when the card has no lorebook, add beside its own (linked, carried in the card, or gone), linked already, none without a character', () => {
    const step = char => { const out = characterStep({ name: NAME, char }); return [out.step, out.note]; };
    assert.deepEqual(step(AVA), ['link', '']);
    assert.deepEqual(step({ ...AVA, world: 'Ava lore' }), ['add', 'Ava has its own lorebook (Ava lore); this one is added beside it.']);
    assert.deepEqual(step({ ...AVA, embedded: true }), ['add', 'Ava has its own lorebook; this one is added beside it.']);
    assert.equal(step({ ...AVA, world: 'A book since deleted' })[0], 'add');
    assert.deepEqual(step({ ...AVA, world: NAME }), ['linked', 'Linked to Ava.']);
    assert.deepEqual(step({ ...AVA, world: 'Ava lore', extras: ['Other', NAME] }), ['linked', 'Linked to Ava.']);
    assert.deepEqual(step({ ...AVA, extras: null }), ['link', '']);
    assert.deepEqual(step(null), ['none', 'Open a character chat to use the lorebook with that character.']);
    assert.deepEqual(step({ group: true }), ['none', 'This is a group chat: pick a character chat to use the lorebook with that character.']);
});

test('the Use with this character tick: on by default (also beside the card’s own book), off and locked with no character chat; Move only for this pack’s book as the chat lorebook', () => {
    const pack = { id: 'tiny', name: 'Tiny World', version: '1.0.0' };
    assert.deepEqual(lorebookRow({ pack, char: AVA }).use, { on: true, disabled: false, note: '' });
    assert.equal(lorebookRow({ pack, char: { ...AVA, world: 'Ava lore' } }).use.on, true);
    assert.equal(lorebookRow({ pack, names: [NAME], char: { ...AVA, world: NAME } }).linked, true);
    assert.deepEqual(lorebookRow({ pack }).use, { on: false, disabled: true, note: 'Open a character chat to use the lorebook with that character.' });
    assert.equal(lorebookRow({ pack, char: { group: true } }).use.disabled, true);
    assert.equal(lorebookRow({ pack, names: [NAME], char: AVA, chatBook: NAME }).move, true);
    assert.equal(lorebookRow({ pack, names: [NAME], char: AVA, chatBook: 'MemoryBook Ava' }).move, false);
    assert.equal(lorebookRow({ pack, names: [NAME], chatBook: NAME }).move, false);
    assert.equal(lorebookRow({ pack, char: AVA, chatBook: NAME }).move, false);
});

test('the step: a book of that name the suite did not make, or made from another pack, is never written over', () => {
    const pack = tiny('1.1.0');
    const made = version => lorebookFromPack(tiny(version)).book;
    assert.equal(lorebookStep({ pack, name: NAME }).step, 'write');
    assert.match(lorebookStep({ pack, name: NAME, existing: userBook }).message, /Story Suite did not make it/);
    assert.equal(lorebookStep({ pack, name: NAME, existing: lorebookFromPack({ ...tiny(), id: 'other' }).book }).step, 'refuse');
    assert.equal(lorebookStep({ pack, name: NAME, existing: made('1.1.0') }).step, 'current');
    // (the same version made before the format was stamped, keyed lore at depth 4: replaced after a confirm)
    const older = made('1.1.0'); older.entries[0].content = JSON.stringify({ pack: 'tiny', version: '1.1.0' });
    assert.equal(lorebookStep({ pack, name: NAME, existing: older }).step, 'confirm');
    assert.deepEqual(lorebookStep({ pack, name: NAME, existing: made('1.0.0') }), { step: 'confirm', update: true, message: `This replaces the book ${NAME}; edits you made in it are lost.` });
    assert.equal(lorebookStep({ pack, name: NAME, existing: made('1.0.0'), confirmed: true }).step, 'write');
});

test('Create on a card with no lorebook: saved, linked to the character, remembered; the chat lorebook is left as it is', async () => {
    const st = fakeBooks({ chatBook: 'MemoryBook Ava' });
    const d = deps(st);
    const answer = await makeLorebook(d, { id: 'tiny', use: true });
    assert.deepEqual(answer, { ok: true, text: `Made ${NAME} (1 entry; 1 hidden entry kept out). Linked to Ava.`, errors: [] });
    assert.deepEqual(st.calls, { saves: [NAME], linked: [NAME], added: [], cleared: [] });
    assert.equal(st.books.chatBook(), 'MemoryBook Ava');
    assert.deepEqual(d.settings.root.lorebooks, { tiny: { name: NAME, version: '1.0.0', format: LOREBOOK_FORMAT } });
    assert.equal(JSON.stringify(st.files[NAME]).includes('Sealed'), false);
});

test('Create on a card with its own lorebook: the card keeps it and the book is added to the character’s lorebooks', async () => {
    const st = fakeBooks({ char: { ...AVA, world: 'Ava lore' } });
    const answer = await makeLorebook(deps(st), { id: 'tiny', use: true });
    assert.equal(answer.text, `Made ${NAME} (1 entry; 1 hidden entry kept out). Added to Ava’s lorebooks (Ava keeps its own).`);
    assert.deepEqual([st.calls.linked, st.calls.added, st.who.world], [[], [NAME], 'Ava lore']);
    const carried = fakeBooks({ char: { ...AVA, embedded: true } });
    await makeLorebook(deps(carried), { id: 'tiny', use: true });
    assert.deepEqual([carried.calls.linked, carried.calls.added], [[], [NAME]]);
});

test('the tick off: made, nothing linked or added', async () => {
    const st = fakeBooks();
    const answer = await makeLorebook(deps(st), { id: 'tiny', use: false });
    assert.equal(answer.text, `Made ${NAME} (1 entry; 1 hidden entry kept out).`);
    assert.deepEqual([st.calls.linked, st.calls.added, st.who.world], [[], [], '']);
});

test('Update: asks first, then replaces only the marker book; the same version again is Up to date, saves nothing and says Linked', async () => {
    const st = fakeBooks({ files: { [NAME]: lorebookFromPack(tiny('1.0.0')).book } });
    const d = deps(st, tiny('1.1.0'));
    const asked = await makeLorebook(d, { id: 'tiny', use: true });
    assert.deepEqual([asked.ok, asked.confirm, st.calls.saves], [false, true, []]);
    const done = await makeLorebook(d, { id: 'tiny', use: true, confirmed: true });
    assert.match(done.text, /^Updated Tiny World \(Story Suite\) \(1 entry; 1 hidden entry kept out\)\. Linked to Ava\.$/);
    const again = await makeLorebook(d, { id: 'tiny', use: true, confirmed: true });
    assert.equal(again.state, 'current');
    assert.equal(again.text, `${NAME} is up to date (made from Tiny World 1.1.0). Linked to Ava.`);
    assert.deepEqual([st.calls.saves, st.calls.linked], [[NAME], [NAME]]);
});

test('refusals: a user book of that name, a pack not installed or with no lore, a failed save; no character chat, a group chat or a failed link keep the book made', async () => {
    const mine = fakeBooks({ files: { [NAME]: userBook } });
    const refused = await makeLorebook(deps(mine), { id: 'tiny', confirmed: true });
    assert.equal(refused.ok, false);
    assert.match(refused.text, /did not make it/);
    assert.deepEqual(mine.files[NAME], userBook);
    assert.equal((await makeLorebook({ packs: packsOf(), books: mine.books }, { id: 'tiny' })).text, 'That world pack is not installed.');
    assert.match((await makeLorebook({ packs: packsOf(tiny('1.0.0', { content: { lore: [] } })), books: mine.books }, { id: 'tiny' })).text, /has no lore/);
    assert.match((await makeLorebook(deps(fakeBooks({ saveFails: true })), { id: 'tiny' })).text, /was not saved \(the server answered 500\)/);
    const none = await makeLorebook(deps(fakeBooks({ char: null })), { id: 'tiny', use: true });
    assert.deepEqual([none.ok, none.text.endsWith('Open a character chat to use the lorebook with that character.')], [true, true]);
    assert.match((await makeLorebook(deps(fakeBooks({ char: { group: true } })), { id: 'tiny', use: true })).text, /group chat: pick a character chat/);
    assert.match((await makeLorebook(deps(fakeBooks({ linkFails: true })), { id: 'tiny', use: true })).text, /It was not linked to Ava \(SillyTavern did not keep the link\)\.$/);
});

test('Move: this pack’s book as the chat lorebook goes with the character, then the chat lorebook is unset; another chat lorebook or a book without the marker is left', async () => {
    const book = () => lorebookFromPack(tiny()).book;
    const st = fakeBooks({ files: { [NAME]: book() }, chatBook: NAME });
    const moved = await makeLorebook(deps(st), { id: 'tiny', move: true });
    assert.deepEqual(moved, { ok: true, text: 'Linked to Ava. It is no longer this chat’s lorebook.', errors: [] });
    assert.deepEqual([st.calls.saves, st.calls.linked, st.calls.cleared, st.books.chatBook()], [[], [NAME], [NAME], '']);
    const other = fakeBooks({ files: { [NAME]: book() }, chatBook: 'MemoryBook Ava' });
    assert.equal((await makeLorebook(deps(other), { id: 'tiny', move: true })).ok, false);
    assert.deepEqual([other.calls.linked, other.calls.cleared, other.books.chatBook()], [[], [], 'MemoryBook Ava']);
    const notOurs = fakeBooks({ files: { [NAME]: userBook }, chatBook: NAME });
    assert.equal((await makeLorebook(deps(notOurs), { id: 'tiny', move: true })).ok, false);
    assert.equal(notOurs.books.chatBook(), NAME);
    const failed = fakeBooks({ files: { [NAME]: book() }, chatBook: NAME, linkFails: true });
    const kept = await makeLorebook(deps(failed), { id: 'tiny', move: true });
    assert.deepEqual([kept.ok, kept.text.endsWith('It stays this chat’s lorebook for now.'), failed.books.chatBook()], [false, true, NAME]);
});

test('rows: only installed world packs that check and have lore', () => {
    const st = fakeBooks();
    const rows = lorebookRows({ list: [{ id: 'tiny', kind: 'world', name: 'Tiny World', version: '1.0.0', counts: { lore: 2 } }, { id: 'g', kind: 'game', name: 'G', counts: {} }, { id: 'bare', kind: 'world', name: 'Bare', counts: {} }, { id: 'bad', kind: 'world', problem: 'x', counts: { lore: 1 } }], books: st.books, settings: fakeSettings() });
    assert.deepEqual(rows.map(row => [row.id, row.state, row.name, row.use.on]), [['tiny', 'create', NAME, true]]);
});
