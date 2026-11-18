// The kinds editor (ST-KINDS): the place and route kind tables (engine class, uses, rename that carries the places along, remove,
// add, kinds used but not mapped), the market cards (type and tag fields, rename, used by, move, remove, add), the buttons for the
// kind keys a pack lacks, and the read-only fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/kinds.js';
import { PLACE_CLASSES, ROUTE_CLASSES } from '../../../packs/limits.js';
import { validatePack } from '../../../packs/validate.js';
import { apply } from '../../../studio/model/edits.js';
import { openDoc } from '../../../studio/model/doc.js';

const MINI = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));

function world() {
    const pack = structuredClone(MINI);
    pack.content.routeKinds = { lane: 'road' };
    pack.content.routes[0].kind = 'lane';
    pack.content.places[1].tags = ['wet', 'coastal'];
    pack.content.places[0].market = 'town';
    pack.content.markets = [{ type: 'town', buy: 1.1, stock: [2, 6] }, { tag: 'coastal', prices: { fish: 0.8 }, note: 'Fish is cheap.' }];
    return pack;
}

function setup(key, opts = {}) {
    installFakeDom();
    const pack = opts.pack ?? world();
    const commits = [];
    const went = [];
    const kept = {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, problems: opts.problems ?? [], focus: opts.focus ?? null,
        commit: patches => { commits.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; },
        keep: id => (kept[id] ??= {}), go: (...args) => went.push(args), ...opts.ctx };
    const value = pack.content[key];
    const nodes = editSection({ key, where: 'content', value, count: Array.isArray(value) ? value.length : Object.keys(value ?? {}).length }, ctx);
    return { pack, nodes, root: nodes[0], commits, went };
}
const kindRow = (root, word) => root.querySelector(`[data-kind="${word}"]`);
const card = (root, i) => root.querySelector(`[data-rec="markets.${i}"]`);
const picked = select => select.querySelectorAll('option').find(o => o.getAttribute('selected') !== null && o.selected !== false)?.textContent;
const field = (root, i, key) => card(root, i).querySelector(`[data-key="${key}"]`);

test('a kind map is a table: each word, its engine class, how many records use it, and the class list', () => {
    const { root } = setup('placeKinds');
    assert.equal(root.querySelector('.secl2').textContent, 'Place kinds · 2');
    const row = kindRow(root, 'lock town');
    assert.equal(row.querySelector('input.st-kword').value, 'lock town');
    assert.deepEqual(row.querySelectorAll('option').map(o => o.textContent), [...PLACE_CLASSES]);
    assert.equal(picked(row), 'town');
    assert.match(row.textContent, /1 place use it/);
    assert.match(root.textContent, new RegExp(`Engine classes: ${PLACE_CLASSES.join(', ')}`));
    const routes = setup('routeKinds').root;
    assert.deepEqual(kindRow(routes, 'lane').querySelectorAll('option').map(o => o.textContent), [...ROUTE_CLASSES]);
    assert.match(kindRow(routes, 'lane').textContent, /1 route use it/);
});

test('picking a class sets that key; a mapped value that is no class is kept in the list so it can be seen', () => {
    const pack = world();
    pack.content.placeKinds.marsh = 'swamp';
    const { root, commits } = setup('placeKinds', { pack });
    const pick = kindRow(root, 'lock town').querySelector('select');
    pick.value = 'city'; pick.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'placeKinds', 'lock town'], value: 'city' }]);
    assert.equal(kindRow(root, 'marsh').querySelectorAll('option')[0].textContent, 'swamp');
});

test('renaming a kind keeps the map order and moves every place of that kind to the new word in the same step', () => {
    const { root, commits } = setup('placeKinds');
    const name = kindRow(root, 'lock town').querySelector('input');
    name.value = ' canal town '; name.dispatch('change');
    assert.deepEqual(commits.at(-1), [
        { op: 'set', path: ['content', 'placeKinds'], value: { 'canal town': 'town', marsh: 'none' } },
        { op: 'set', path: ['content', 'places', 0, 'kind'], value: 'canal town' },
    ]);
    assert.deepEqual(Object.keys(commits.at(-1)[0].value), ['canal town', 'marsh']);
});

test('a rename to a word already mapped, or to nothing, is refused inline and makes no edit', () => {
    const { root, commits } = setup('placeKinds');
    const row = kindRow(root, 'lock town');
    const name = row.querySelector('input');
    name.value = 'marsh'; name.dispatch('change');
    assert.match(row.querySelector('.st-problem').textContent, /already in this list/);
    name.value = '  '; name.dispatch('change');
    assert.match(row.querySelector('.st-problem').textContent, /1 to 40 characters/);
    assert.equal(commits.length, 0);
});

test('a kind in use cannot be removed unless it is an engine class itself; an unused one is one remove patch', () => {
    const pack = world();
    pack.content.placeKinds.town = 'town';
    pack.content.places[1].kind = 'town';
    const { root, commits } = setup('placeKinds', { pack });
    kindRow(root, 'lock town').querySelector('.st-remove').click();
    assert.match(kindRow(root, 'lock town').querySelector('.st-problem').textContent, /1 place use it: give it another kind first/);
    assert.equal(commits.length, 0);
    kindRow(root, 'town').querySelector('.st-remove').click();
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'placeKinds', 'town'] }]);
    kindRow(root, 'marsh').querySelector('.st-remove').click();
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'placeKinds', 'marsh'] }]);
});

test('Add a kind uses a free word mapped to none; kinds used but not mapped are offered one click each; a refusal shows', () => {
    const pack = world();
    pack.content.placeKinds['new-kind'] = 'site';
    pack.content.places[1].kind = 'bog';
    const { root, commits } = setup('placeKinds', { pack });
    root.querySelector('.st-add').click();
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'placeKinds', 'new-kind-2'], value: 'none' }]);
    const loose = root.querySelectorAll('.st-map');
    assert.deepEqual(loose.map(b => b.textContent), ['+ bog']);
    loose[0].click();
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'placeKinds', 'bog'], value: 'none' }]);
    const refused = setup('placeKinds', { refuse: true }).root;
    kindRow(refused, 'marsh').querySelector('select').value = 'site';
    kindRow(refused, 'marsh').querySelector('select').dispatch('change');
    assert.equal(kindRow(refused, 'marsh').querySelector('.st-problem').textContent, 'No.');
});

test('a checker problem on a kind shows on its row, and one on the whole map above the table', () => {
    const problems = [{ path: 'content.placeKinds.marsh', message: 'marsh maps to swamp.' }, { path: 'content.placeKinds', message: 'Too many.' }];
    const { root } = setup('placeKinds', { problems, focus: { rec: null, path: ['marsh'] } });
    assert.equal(kindRow(root, 'marsh').querySelector('.st-problem').textContent, 'marsh maps to swamp.');
    assert.ok(kindRow(root, 'marsh').querySelector('input').classList.contains('st-at'));
    assert.equal(root.querySelector('.st-kinds > .st-problem').textContent, 'Too many.');
});

test('markets: a type card has buy, sell and stock, a tag card has prices, and each lists the places that use it', () => {
    const { root, went } = setup('markets');
    assert.equal(root.querySelector('.secl2').textContent, 'Markets · 2');
    assert.equal(field(root, 0, 'type').querySelector('input').value, 'town');
    assert.equal(String(field(root, 0, 'buy').querySelector('input').value), '1.1');
    assert.equal(field(root, 0, 'stock').querySelector('input').value, '2-6');
    assert.equal(field(root, 1, 'prices').querySelectorAll('.kc').map(c => c.textContent.replace(/×$/, '')).join(), 'fish ×0.8');
    assert.equal(field(root, 1, 'buy'), null);
    const used = field(root, 0, 'used-by').querySelectorAll('.st-used');
    assert.deepEqual(used.map(b => b.dataset.rec), ['places.0']);
    used[0].click();
    assert.deepEqual(went.at(-1), ['map', 'places.0']);
    assert.deepEqual(field(root, 1, 'used-by').querySelectorAll('.st-used').map(b => b.dataset.rec), ['places.1']);
});

test('market fields: a factor out of range and a bad stock are refused inline; blank removes; good values set', () => {
    const { root, commits } = setup('markets');
    const buy = field(root, 0, 'buy').querySelector('input');
    buy.value = '9'; buy.dispatch('change');
    assert.match(field(root, 0, 'buy').querySelector('.st-problem').textContent, /0.25 to 4/);
    buy.value = ''; buy.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'markets', 0, 'buy'] }]);
    const sell = field(root, 0, 'sell').querySelector('input');
    sell.value = '0.9'; sell.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'markets', 0, 'sell'], value: 0.9 }]);
    const stock = field(root, 0, 'stock').querySelector('input');
    stock.value = '6-2'; stock.dispatch('change');
    assert.match(field(root, 0, 'stock').querySelector('.st-problem').textContent, /the least first/);
    stock.value = '3 to 8'; stock.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'markets', 0, 'stock'], value: [3, 8] }]);
    const note = field(root, 1, 'note').querySelector('textarea');
    note.value = 'x'.repeat(201); note.dispatch('change');
    assert.match(field(root, 1, 'note').querySelector('.st-problem').textContent, /At most 200/);
    note.value = ''; note.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'markets', 1, 'note'] }]);
});

test('tag prices: a good chip sets the whole map; a bad one is refused inline', () => {
    const { root, commits } = setup('markets');
    const add = field(root, 1, 'prices').querySelector('input.kadd');
    add.value = 'salt ×1.5'; add.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'markets', 1, 'prices'], value: { fish: 0.8, salt: 1.5 } }]);
    const again = field(root, 1, 'prices').querySelector('input.kadd');
    again.value = 'Gold ×9'; again.dispatch('change');
    assert.match(field(root, 1, 'prices').querySelector('.st-problem').textContent, /not a price/);
    assert.equal(commits.length, 1);
});

test('renaming a type or a tag carries the places that name it; a bad or taken word is refused', () => {
    const { root, commits } = setup('markets');
    const type = field(root, 0, 'type').querySelector('input');
    type.value = 'Big Town'; type.dispatch('change');
    assert.match(field(root, 0, 'type').querySelector('.st-problem').textContent, /lowercase word/);
    type.value = 'market-town'; type.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'markets', 0, 'type'], value: 'market-town' }, { op: 'set', path: ['content', 'places', 0, 'market'], value: 'market-town' }]);
    const tag = field(root, 1, 'tag').querySelector('input');
    tag.value = 'seaside'; tag.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'markets', 1, 'tag'], value: 'seaside' }, { op: 'set', path: ['content', 'places', 1, 'tags'], value: ['wet', 'seaside'] }]);
    const pack = world();
    pack.content.markets.push({ tag: 'river', prices: {} });
    const two = setup('markets', { pack });
    const input = field(two.root, 2, 'tag').querySelector('input');
    input.value = 'coastal'; input.dispatch('change');
    assert.match(field(two.root, 2, 'tag').querySelector('.st-problem').textContent, /already in this list/);
    assert.equal(two.commits.length, 0);
});

test('markets move and remove; a type a place names cannot be removed; Add makes a type or a tag with a free word', () => {
    const { root, commits } = setup('markets');
    card(root, 1).querySelector('.st-up').click();
    assert.deepEqual(commits.at(-1), [{ op: 'move', path: ['content', 'markets', 1], to: 0 }]);
    assert.notEqual(card(root, 0).querySelector('.st-up').getAttribute('disabled'), null);
    assert.equal(card(root, 1).querySelector('.st-up').getAttribute('disabled'), null);
    card(root, 0).querySelector('.st-remove').click();
    assert.match(card(root, 0).querySelector('.subrow .st-problem').textContent, /1 place names it as its market/);
    card(root, 1).querySelector('.st-remove').click();
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'markets', 1] }]);
    root.querySelector('[data-add="type"]').click();
    assert.deepEqual(commits.at(-1), [{ op: 'insert', path: ['content', 'markets', 2], value: { type: 'new-type' } }]);
    root.querySelector('[data-add="tag"]').click();
    assert.deepEqual(commits.at(-1), [{ op: 'insert', path: ['content', 'markets', 2], value: { tag: 'new-tag', prices: {} } }]);
});

test('a market problem shows on its field, and Go to marks the field', () => {
    const problems = [{ path: 'content.markets[0].stock', message: 'stock must be [least, most].' }];
    const { root } = setup('markets', { problems, focus: { rec: 'markets.0', path: ['stock'] } });
    assert.equal(field(root, 0, 'stock').querySelector('.st-problem').textContent, 'stock must be [least, most].');
    assert.ok(field(root, 0, 'stock').querySelector('input').classList.contains('st-at'));
});

test('the last kind section the pack has offers the ones it lacks', () => {
    const pack = structuredClone(MINI);
    const { nodes, commits } = setup('placeKinds', { pack });
    assert.equal(nodes.length, 2);
    const buttons = nodes[1].querySelectorAll('button');
    assert.deepEqual(buttons.map(b => b.textContent), ['+ Add route kinds', '+ Add markets']);
    buttons[1].click();
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'markets'], value: [] }]);
    assert.equal(setup('placeKinds').nodes.length, 1);
});

test('a format 3 pack, a map that is not an object, or no commit draws the read-only cards', () => {
    const legacy = setup('placeKinds', { ctx: { legacy: true } });
    assert.equal(legacy.root.querySelector('.st-kword'), null);
    const pack = world();
    pack.content.markets = { town: 1 };
    assert.equal(setup('markets', { pack }).root.querySelector('.st-up'), null);
    assert.equal(setup('routeKinds', { ctx: { commit: undefined } }).root.querySelector('.st-kword'), null);
});

test('the patches the editor makes, applied to the pack, still pass the game\'s own pack checker', () => {
    const pack = world();
    assert.equal(validatePack(JSON.stringify(pack)).ok, true);
    let doc = openDoc({ doc: pack });
    const step = (key, act) => {
        const { root, commits } = setup(key, { pack: structuredClone(doc.doc) });
        act(root);
        const done = apply(doc, commits.at(-1));
        assert.equal(done.ok, true, done.refusal);
        doc = done.doc;
    };
    step('placeKinds', root => { const name = kindRow(root, 'lock town').querySelector('input'); name.value = 'canal town'; name.dispatch('change'); });
    step('routeKinds', root => { const name = kindRow(root, 'lane').querySelector('input'); name.value = 'tow path'; name.dispatch('change'); });
    step('markets', root => { const type = field(root, 0, 'type').querySelector('input'); type.value = 'market-town'; type.dispatch('change'); });
    step('markets', root => { const tag = field(root, 1, 'tag').querySelector('input'); tag.value = 'seaside'; tag.dispatch('change'); });
    const result = validatePack(doc.text);
    assert.deepEqual(result.errors ?? [], []);
    assert.equal(doc.doc.content.places[0].kind, 'canal town');
    assert.equal(doc.doc.content.routes[0].kind, 'tow path');
    assert.equal(doc.doc.content.places[0].market, 'market-town');
});

test('a place kind rename carries the where.kinds of templates and world events; one they name cannot be removed', () => {
    const pack = world();
    pack.content.templates = [{ template: 'market-day', where: { kinds: ['lock town', 'village'] } }];
    pack.content.worldEvents = [{ id: 'flood', where: { kinds: ['lock town'] } }, { id: 'quiet', where: ['fenhold'] }];
    const renamed = setup('placeKinds', { pack });
    const box = kindRow(renamed.root, 'lock town').querySelector('input.st-kword');
    box.value = 'canal town';
    box.dispatch('change');
    const patches = renamed.commits.at(-1);
    assert.deepEqual(patches.filter(patch => patch.path.includes('where')), [
        { op: 'set', path: ['content', 'templates', 0, 'where', 'kinds'], value: ['canal town', 'village'] },
        { op: 'set', path: ['content', 'worldEvents', 0, 'where', 'kinds'], value: ['canal town'] }]);
    // with no place using it, the events and templates that name it still keep it
    const unused = world();
    unused.content.places = unused.content.places.filter(place => place.kind !== 'lock town');
    unused.content.worldEvents = [{ id: 'flood', where: { kinds: ['lock town'] } }];
    const drop = setup('placeKinds', { pack: unused });
    kindRow(drop.root, 'lock town').querySelector('.st-remove').click();
    assert.deepEqual(drop.commits, []);
    assert.match(kindRow(drop.root, 'lock town').querySelector('.st-problem').textContent, /An event or template names it in where\.kinds/);
});
