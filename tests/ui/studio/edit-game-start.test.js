// The game start editor (ST-GSTART): the purse in the smallest coin and what it comes to, the item rows (name, qty, note) as patches,
// move, remove and add, the inline refusals, the open world's items (unmatched names, "From the world…"), and the read-only fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/game-start.js';
import { GAME_START_LIMITS } from '../../../packs/limits.js';
import { validatePack } from '../../../packs/validate.js';
import { apply } from '../../../studio/model/edits.js';
import { openDoc } from '../../../studio/model/doc.js';

const MINI = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/game4-mini.json', import.meta.url), 'utf8'));
const WORLD = { content: { items: [{ id: 'rope', name: 'Rope', kind: 'goods' }, { id: 'cloak', name: 'Travel cloak', aliases: ['Cloak'], kind: 'equipment' }] } };

function game() {
    const pack = structuredClone(MINI);
    pack.content.start = { money: 125, items: [{ name: 'Travel cloak' }, { name: 'Waterskin', qty: 2, note: 'Full.' }] };
    return pack;
}

function setup(opts = {}) {
    installFakeDom();
    const pack = opts.pack ?? game();
    const commits = [];
    const ctx = { doc: { doc: pack }, kind: 'game', legacy: false, other: opts.other ?? null, problems: opts.problems ?? [], focus: null,
        commit: patches => { commits.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; },
        keep: () => ({}), go: () => {}, ...opts.ctx };
    const nodes = editSection({ key: 'start', where: 'content', value: pack.content.start, count: 1 }, ctx);
    return { pack, nodes, root: nodes[0], commits };
}
const row = (root, i) => root.querySelector(`.st-item[data-index="${i}"]`);
const money = root => root.querySelector('[data-key="money"]');

test('the purse shows the money in the smallest coin, its unit, and what it comes to in the pack\'s coins', () => {
    const { root } = setup();
    assert.equal(String(money(root).querySelector('input').value), '125');
    assert.match(money(root).textContent, /pennies/);
    assert.match(money(root).textContent, /in pennies \(the smallest coin\): 125 pennies = 1 crown 25 pennies/);
    const pack = game();
    pack.content.start.money = 40;
    assert.doesNotMatch(setup({ pack }).root.querySelector('[data-key="money"]').textContent, /=/);
    delete pack.content.currency;
    assert.match(setup({ pack }).root.querySelector('[data-key="money"]').textContent, /the smallest coin of the game's money/);
});

test('money: a whole number is one set patch; blank removes it; a bad amount is refused inline', () => {
    const { root, commits } = setup();
    const input = money(root).querySelector('input');
    input.value = '300'; input.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'start', 'money'], value: 300 }]);
    input.value = '2.5'; input.dispatch('change');
    assert.match(money(root).querySelector('.st-problem').textContent, /whole number from 0/);
    input.value = ''; input.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'start', 'money'] }]);
    assert.equal(commits.length, 2);
});

test('one row per item with its name, qty (1 when left out) and note, the count and the limit', () => {
    const { root } = setup();
    assert.equal(root.querySelector('.st-items .gt').textContent, 'Items · 2');
    assert.equal(row(root, 0).querySelector('.st-iname').value, 'Travel cloak');
    assert.equal(String(row(root, 0).querySelector('input[type="number"]').value), '1');
    assert.equal(String(row(root, 1).querySelector('input[type="number"]').value), '2');
    assert.equal(row(root, 1).querySelector('.st-inote').value, 'Full.');
    assert.match(root.textContent, new RegExp(`2 of ${GAME_START_LIMITS.items} · matched to the world's items by name when a chat starts`));
    assert.equal(root.querySelector('.st-unmatched'), null);
});

test('item edits are patches at their path; a blank qty or note removes the key', () => {
    const { root, commits } = setup();
    const name = row(root, 1).querySelector('.st-iname');
    name.value = '  Water   skin '; name.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'start', 'items', 1, 'name'], value: 'Water skin' }]);
    const qty = row(root, 0).querySelector('input[type="number"]');
    qty.value = '3'; qty.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'start', 'items', 0, 'qty'], value: 3 }]);
    const qty2 = row(root, 1).querySelector('input[type="number"]');
    qty2.value = ''; qty2.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'start', 'items', 1, 'qty'] }]);
    const note = row(root, 1).querySelector('.st-inote');
    note.value = ' '; note.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'start', 'items', 1, 'note'] }]);
    const note0 = row(root, 0).querySelector('.st-inote');
    note0.value = 'Patched.'; note0.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'start', 'items', 0, 'note'], value: 'Patched.' }]);
});

test('a blank or repeated name, a bad qty and a long note are refused inline with no edit', () => {
    const { root, commits } = setup();
    const name = row(root, 1).querySelector('.st-iname');
    name.value = ' '; name.dispatch('change');
    assert.match(row(root, 1).querySelector('.st-problem').textContent, /1 to 80 characters/);
    name.value = 'travel CLOAK'; name.dispatch('change');
    assert.match(row(root, 1).querySelector('.st-problem').textContent, /already in the list/);
    const qty = row(root, 0).querySelector('input[type="number"]');
    qty.value = '0'; qty.dispatch('change');
    assert.match(row(root, 0).querySelector('.st-problem').textContent, /1 to 9999/);
    const note = row(root, 0).querySelector('.st-inote');
    note.value = 'x'.repeat(501); note.dispatch('change');
    assert.match(row(root, 0).querySelector('.st-problem').textContent, /at most 500/);
    assert.equal(commits.length, 0);
});

test('rows move and are removed; the ends cannot move past the list; a refusal shows on the row', () => {
    const { root, commits } = setup();
    assert.notEqual(row(root, 0).querySelector('.st-up').getAttribute('disabled'), null);
    assert.notEqual(row(root, 1).querySelector('.st-down').getAttribute('disabled'), null);
    row(root, 1).querySelector('.st-up').click();
    assert.deepEqual(commits.at(-1), [{ op: 'move', path: ['content', 'start', 'items', 1], to: 0 }]);
    row(root, 0).querySelector('.st-remove').click();
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'start', 'items', 0] }]);
    const refused = setup({ refuse: true }).root;
    row(refused, 0).querySelector('.st-down').click();
    assert.equal(row(refused, 0).querySelector('.st-problem').textContent, 'No.');
});

test('Add an item inserts a free name, or makes the list when the start has none; it is off at the limit', () => {
    const { root, commits } = setup();
    root.querySelector('.st-add').click();
    assert.deepEqual(commits.at(-1), [{ op: 'insert', path: ['content', 'start', 'items', 2], value: { name: 'New item' } }]);
    const pack = game();
    pack.content.start = { money: 5 };
    const empty = setup({ pack });
    assert.match(empty.root.textContent, /no items/);
    empty.root.querySelector('.st-add').click();
    assert.deepEqual(empty.commits.at(-1), [{ op: 'set', path: ['content', 'start', 'items'], value: [{ name: 'New item' }] }]);
    const full = game();
    full.content.start.items = Array.from({ length: GAME_START_LIMITS.items }, (_, n) => ({ name: n ? `New item ${n + 1}` : 'New item' }));
    assert.notEqual(setup({ pack: full }).root.querySelector('.st-add').getAttribute('disabled'), null);
});

test('with a world open, a name that is not its item (or other name) says so, and From the world adds one by name', () => {
    const pack = game();
    pack.content.start.items.push({ name: 'cloak' });
    const { root, commits } = setup({ pack, other: { doc: WORLD } });
    assert.equal(row(root, 0).querySelector('.st-unmatched'), null);
    assert.match(row(root, 1).querySelector('.st-unmatched').textContent, /a chat makes it up/);
    assert.equal(row(root, 2).querySelector('.st-unmatched'), null);
    root.querySelector('.st-from-world').click();
    const rows = globalThis.document.querySelectorAll('.slist button');
    assert.deepEqual(rows.map(b => b.dataset.id), ['Rope', 'Travel cloak']);
    assert.equal(rows[1].getAttribute('aria-disabled'), 'true');
    rows[0].click();
    assert.deepEqual(commits.at(-1), [{ op: 'insert', path: ['content', 'start', 'items', 3], value: { name: 'Rope' } }]);
    assert.equal(setup().root.querySelector('.st-from-world'), null);
});

test('checker problems show on the money, the row and the list', () => {
    const problems = [{ path: 'content.start.money', message: 'money must be whole.' }, { path: 'content.start.items[1].qty', message: 'qty bad.' }, { path: 'content.start.items', message: 'Too many.' }];
    const { root } = setup({ problems });
    assert.equal(money(root).querySelector('.st-problem').textContent, 'money must be whole.');
    assert.equal(row(root, 1).querySelector('.st-problem').textContent, 'qty bad.');
    assert.equal(row(root, 0).querySelector('.st-problem'), null);
    assert.equal(root.querySelector('.st-items > .st-problem').textContent, 'Too many.');
});

test('a format 3 pack, a start that is not an object, items that are not a list, or no commit draws the read-only cards', () => {
    assert.equal(setup({ ctx: { legacy: true } }).root.querySelector('.st-item'), null);
    assert.equal(setup({ ctx: { commit: undefined } }).root.querySelector('.st-item'), null);
    const pack = game();
    pack.content.start.items = 'rope';
    assert.equal(setup({ pack }).root.querySelector('.st-add'), null);
    pack.content.start = ['rope'];
    assert.equal(setup({ pack }).root.querySelector('.st-add'), null);
});

test('the editor\'s patches, applied to the pack, still pass the game\'s own pack checker', () => {
    let doc = openDoc({ doc: game() });
    assert.deepEqual(validatePack(doc.text).errors ?? [], []);
    const step = act => {
        const { root, commits } = setup({ pack: structuredClone(doc.doc) });
        act(root);
        const done = apply(doc, commits.at(-1));
        assert.equal(done.ok, true, done.refusal);
        doc = done.doc;
    };
    step(root => { const input = money(root).querySelector('input'); input.value = '40'; input.dispatch('change'); });
    step(root => root.querySelector('.st-add').click());
    step(root => { const qty = row(root, 2).querySelector('input[type="number"]'); qty.value = '4'; qty.dispatch('change'); });
    step(root => row(root, 0).querySelector('.st-down').click());
    step(root => { const note = row(root, 0).querySelector('.st-inote'); note.value = ''; note.dispatch('change'); });
    assert.deepEqual(validatePack(doc.text).errors ?? [], []);
    assert.deepEqual(doc.doc.content.start, { money: 40, items: [{ name: 'Waterskin', qty: 2 }, { name: 'Travel cloak' }, { name: 'New item', qty: 4 }] });
});
