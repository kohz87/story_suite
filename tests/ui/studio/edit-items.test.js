// The Studio's items and foes editor: the two lists (counts, filters, search, New), one record's page (every field writes one patch, the
// local checks refuse what the pack checker would), Duplicate and the Delete confirm, starting the other list, "used by", the focus and
// the fallback. Edited packs still pass the game's own pack checker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/items.js';
import { openDoc } from '../../../studio/model/doc.js';
import { apply } from '../../../studio/model/edits.js';
import { validatePack } from '../../../packs/validate.js';

const WORLD = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const ITEMS = [
    { name: 'Iron Sword', kind: 'equipment', rarity: 'rare', value: 120, slot: 'weapon', stats: { STR: 2 } },
    { name: 'Rye Bread', value: 2, effect: { heal: 5 }, tags: ['food'] },
    { name: 'Lamp Oil', kind: 'consumable', note: 'Burns for a night.', extra: 1 },
];
const FOES = [
    { name: 'Weir Rat', aliases: ['rat'], tier: 'mob', level: 1, about: 'A river rat of the weirs.', tags: ['river'] },
    { name: 'Fen Wight', tier: 'elite' },
];
const CONDITIONS = [{ name: 'bread-dear', scope: 'region', means: 'Bread is dear.', effects: { prices: { food: '×2' } } }];

// A host: the document, the kept state, and a `go` that moves the focus and draws both sections again, as the Studio does.
function host({ items = ITEMS, foes = FOES, extra = {} } = {}) {
    installFakeDom();
    // the price effect names an item tag, so it is in the pack only when an item has that tag (the checker refuses it otherwise)
    const tagged = (items ?? []).some(item => item.tags?.includes('food'));
    const content = { ...structuredClone(WORLD.content), conditions: [...WORLD.content.conditions, ...(tagged ? structuredClone(CONDITIONS) : [])] };
    if (items) content.items = structuredClone(items);
    if (foes) content.foes = structuredClone(foes);
    const me = { doc: openDoc({ doc: { ...structuredClone(WORLD), content } }), kept: {}, patches: [], went: [], focus: null, problems: [] };
    me.ctx = () => ({ doc: me.doc, kind: 'world', legacy: false, problems: me.problems, focus: me.focus, keep: id => (me.kept[id] ??= {}),
        commit: patches => { me.patches.push(patches); const result = apply(me.doc, patches); if (result.ok) me.doc = result.doc; return result; },
        go: (part, rec = null, path = null) => { me.went.push([part, rec]); me.focus = rec ? { rec, path } : null; me.draw(); }, ...extra });
    me.draw = () => {
        const nodes = ['items', 'foes'].filter(key => me.doc.doc.content[key] !== undefined).flatMap(key => editSection({ key, where: 'content', value: me.doc.doc.content[key], count: me.doc.doc.content[key].length }, me.ctx()));
        me.root = document.createElement('div');
        me.root.append(...nodes);
        return me.root;
    };
    me.content = () => me.doc.doc.content;
    // what the pack checker refuses, bar the made-up `extra` field the fixture carries on purpose
    me.check = () => (validatePack(me.doc.doc).errors ?? []).filter(problem => !String(problem.path).endsWith('.extra'));
    return me;
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const edit = (input, value) => { input.value = value; input.dispatch('change'); };
const chip = (row, text) => { const box = row.querySelector('input.kadd'); box.value = text; box.dispatch('keydown', { key: 'Enter' }); };
const open = (me, key, index) => { me.focus = null; me.draw().querySelector(`[data-key="${key}"] [data-rec="${key}.${index}"]`).click(); return me.root; };

test('both lists show their counts, a line and a tag for each record, and filter by kind or tier and by search', () => {
    const me = host();
    const root = me.draw();
    const items = root.querySelector('[data-key="items"]');
    assert.equal(items.querySelector('.secl2').textContent, 'Items · 3');
    assert.equal(items.querySelector('.st-counts').textContent, '3 items · 1 goods · 1 consumable · 1 equipment');
    const rows = items.querySelectorAll('.st-itemrow');
    assert.equal(rows.length, 3);
    assert.match(rows[0].textContent, /Iron Sword/);
    assert.match(rows[0].textContent, /equipment · rare · value 120 · worn: weapon/);
    assert.equal(root.querySelector('[data-key="foes"] .st-counts').textContent, '2 foes · 1 mob · 1 elite');
    items.querySelector('[data-filter="consumable"]').click();
    assert.deepEqual(items.querySelectorAll('.st-itemrow').map(row => row.dataset.rec), ['items.2']);
    assert.equal(items.querySelector('[data-filter="consumable"]').getAttribute('aria-pressed'), 'true');
    items.querySelector('[data-filter="all"]').click();
    const search = items.querySelector('.st-search');
    search.value = 'food'; search.dispatch('input');
    assert.deepEqual(items.querySelectorAll('.st-itemrow').map(row => row.dataset.rec), ['items.1'], 'a tag is searched too');
    search.value = 'nothing like it'; search.dispatch('input');
    assert.equal(items.querySelector('.fine:not(.st-counts)').textContent, 'No item matches.');
});

test('a record with problems is marked in the list and found by the Problems filter', () => {
    const me = host();
    me.problems = [{ path: 'content.foes[1].tier', message: 'tier must be one of mob, minion, standard, elite, boss, apex.', level: 'error' }];
    const foes = me.draw().querySelector('[data-key="foes"]');
    assert.equal(foes.querySelector('[data-rec="foes.1"] .st-bad').textContent, '✕ 1');
    foes.querySelector('[data-filter="problems"]').click();
    assert.deepEqual(foes.querySelectorAll('.st-itemrow').map(row => row.dataset.rec), ['foes.1']);
    assert.equal(me.draw().querySelector('[data-key="items"] [data-filter="problems"]'), null, 'no chip where nothing is wrong');
});

test('a row opens its record through Go to; the other list is not drawn while it is open, and Back returns', () => {
    const me = host();
    const root = open(me, 'items', 0);
    assert.deepEqual(me.went.at(-1), ['items', 'items.0']);
    assert.equal(root.querySelector('[data-key="foes"]'), null);
    assert.equal(root.querySelector('.st-entryhead b').textContent, 'Iron Sword');
    assert.match(root.querySelector('.st-entryhead small').textContent, /Item 1 of 3/);
    assert.equal(field(root, 'name').querySelector('input').value, 'Iron Sword');
    assert.equal(root.querySelector('.st-jsonrow .st-jsonshow').getAttribute('aria-label'), 'Show this item as JSON');
    root.querySelector('.st-back').click();
    assert.deepEqual(me.went.at(-1), ['items', null]);
    assert.equal(me.root.querySelectorAll('.st-itemrow').length, 5);
});

test('item fields: each change is one patch, defaults are not written, and equipment drops a written stack in the same step', () => {
    const me = host({ items: [{ name: 'Rope', stack: false }] });
    let root = open(me, 'items', 0);
    edit(field(root, 'name').querySelector('input'), '  Hemp Rope ');
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: ['content', 'items', 0, 'name'], value: 'Hemp Rope' }]);
    root = me.draw();
    edit(field(root, 'name').querySelector('input'), ' ');
    assert.equal(me.patches.length, 1, 'a blank name is refused');
    assert.equal(field(root, 'name').querySelector('.st-problem').textContent, 'An item needs a name.');
    edit(field(root, 'rarity').querySelector('select'), 'common');
    assert.equal(me.patches.length, 1, 'the default rarity is not written');
    edit(field(root, 'kind').querySelector('select'), 'equipment');
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: ['content', 'items', 0, 'kind'], value: 'equipment' }, { op: 'remove', path: ['content', 'items', 0, 'stack'] }]);
    root = me.draw();
    assert.match(field(root, 'stack').textContent, /Equipment never stacks/);
    assert.ok(field(root, 'slot'), 'equipment shows the worn group');
    edit(field(root, 'slot').querySelector('input'), 'weapon');
    edit(field(root, 'bonus').querySelector('input'), '9');
    assert.equal(me.content().items[0].bonus, undefined, 'a bonus past 6 is refused');
    assert.equal(field(root, 'bonus').querySelector('.st-problem').textContent, 'Bonus must be a whole number from 0 to 6.');
    edit(field(root, 'bonus').querySelector('input'), '2');
    assert.equal(me.content().items[0].bonus, 2);
    root = me.draw();
    edit(field(root, 'bonus').querySelector('input'), '');
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'items', 0, 'bonus'] }]);
    edit(field(root, 'value').querySelector('input'), '-1');
    assert.equal(field(root, 'value').querySelector('.st-problem').textContent, 'Value must be a whole number of 0 or more.');
    edit(field(root, 'value').querySelector('input'), '15');
    assert.equal(me.content().items[0].value, 15);
    assert.deepEqual(me.check(), []);
});

test('the stack switch writes false or takes the field out; weight and carry keep to their bounds', () => {
    const me = host({ items: [{ name: 'Salt' }] });
    let root = open(me, 'items', 0);
    field(root, 'stack').querySelector('button.sw').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: ['content', 'items', 0, 'stack'], value: false }]);
    root = me.draw();
    field(root, 'stack').querySelector('button.sw').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'items', 0, 'stack'] }]);
    root = me.draw();
    edit(field(root, 'weight').querySelector('input'), '100');
    assert.equal(me.content().items[0].weight, undefined);
    edit(field(root, 'carry').querySelector('input'), '20');
    assert.equal(me.content().items[0].carry, 20);
    assert.equal(field(root, 'slot'), null, 'goods with nothing worn have no worn group');
});

test('stats and effect are chips that become an object; a chip that does not read is refused and named', () => {
    const me = host();
    let root = open(me, 'items', 0);
    const stats = field(root, 'stats');
    assert.deepEqual(stats.querySelectorAll('.kc').map(c => c.textContent), ['STR +2×']);
    chip(stats, 'dex -1');
    assert.deepEqual(me.content().items[0].stats, { STR: 2, DEX: -1 });
    root = me.draw();
    chip(field(root, 'stats'), 'luck');
    assert.match(field(root, 'stats').querySelector('.st-problem').textContent, /"luck" is not a stat/);
    assert.deepEqual(me.content().items[0].stats, { STR: 2, DEX: -1 });
    root = open(me, 'items', 1);
    const effect = field(root, 'effect');
    assert.deepEqual(effect.querySelectorAll('.kc').map(c => c.textContent), ['heal 5×']);
    chip(effect, 'warm true');
    assert.deepEqual(me.content().items[1].effect, { heal: 5, warm: true });
    root = me.draw();
    field(root, 'effect').querySelector('button[aria-label="Remove heal 5"]').click();
    field(me.draw(), 'effect').querySelector('button[aria-label="Remove warm true"]').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'items', 1, 'effect'] }]);
    assert.deepEqual(me.check(), []);
});

test('an id that another record has is refused; a blank id takes the field out; extra fields are named', () => {
    const me = host();
    const root = open(me, 'items', 2);
    assert.match(root.textContent, /Also in this item, only in the JSON below: extra\./);
    edit(field(root, 'slug').querySelector('input'), 'iron-sword');
    assert.equal(me.patches.length, 0);
    assert.equal(field(root, 'slug').querySelector('.st-problem').textContent, 'Another item has the id "iron-sword".');
    edit(field(root, 'slug').querySelector('input'), 'oil');
    assert.equal(me.content().items[2].slug, 'oil');
    edit(field(me.draw(), 'slug').querySelector('input'), '');
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'items', 2, 'slug'] }]);
});

test('"used by" lists the conditions whose price effect names a tag of the item, and Go to opens the condition', () => {
    const me = host();
    let root = open(me, 'items', 1);
    const go = root.querySelector('.st-goto');
    assert.match(go.closest('.srow').textContent, /bread-dear.*Price effect food ×2/);
    go.click();
    assert.deepEqual(me.went.at(-1), ['conditions', `conditions.${WORLD.content.conditions.length}`]);
    root = open(me, 'items', 0);
    assert.match(root.textContent, /No condition's price effect names its tags\./);
});

test('foe fields: tier, level within 1 to 99, at most 8 other names, and the length of About', () => {
    const me = host({ foes: [{ name: 'Bog Hag', tier: 'huge', about: 'Old.' }] });
    let root = open(me, 'foes', 0);
    const tier = field(root, 'tier').querySelector('select');
    assert.equal(tier.querySelectorAll('option')[0].textContent, '(pick a tier)');
    edit(tier, 'boss');
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: ['content', 'foes', 0, 'tier'], value: 'boss' }]);
    root = me.draw();
    edit(field(root, 'level').querySelector('input'), '120');
    assert.equal(field(root, 'level').querySelector('.st-problem').textContent, 'Level must be a whole number from 1 to 99.');
    edit(field(root, 'level').querySelector('input'), '12');
    assert.equal(me.content().foes[0].level, 12);
    root = me.draw();
    const aliases = field(root, 'aliases');
    for (const name of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']) chip(aliases, name);
    assert.equal(me.content().foes[0].aliases.length, 8);
    chip(aliases, 'a9');
    assert.equal(me.content().foes[0].aliases.length, 8);
    assert.equal(aliases.querySelector('.st-problem').textContent, 'At most 8 other names.');
    root = me.draw();
    assert.equal(field(root, 'about').querySelector('.st-count').textContent, '4 of 240 characters');
    edit(field(root, 'about').querySelector('textarea'), 'A hag of the bog.');
    assert.equal(me.content().foes[0].about, 'A hag of the bog.');
    assert.deepEqual(me.check(), []);
});

test('New adds a record under a free name and opens it; Duplicate copies without the id; Delete asks first', () => {
    const me = host({ items: [{ name: 'New item' }, { name: 'Cord', slug: 'cord' }] });
    me.draw().querySelector('[data-key="items"] .st-new').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'insert', path: ['content', 'items', 2], value: { name: 'New item 2', kind: 'goods' } }]);
    assert.deepEqual(me.went.at(-1), ['items', 'items.2']);
    assert.equal(me.draw().querySelector('[data-key="foes"]'), null, 'the foes list waits while an item is open');
    let root = open(me, 'items', 1);
    root.querySelector('.st-dup').click();
    assert.deepEqual(me.content().items[2], { name: 'Cord copy' });
    assert.deepEqual(me.went.at(-1), ['items', 'items.2']);
    me.root.querySelector('.st-del').click();
    assert.ok(me.root.querySelector('.st-sure'));
    me.root.querySelector('.st-keep').click();
    assert.equal(me.root.querySelector('.st-sure'), null);
    me.root.querySelector('.st-del').click();
    me.root.querySelector('.st-sure').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'items', 2] }]);
    assert.deepEqual(me.went.at(-1), ['items', null]);
    me.draw().querySelector('[data-key="foes"] .st-new').click();
    assert.deepEqual(me.content().foes.at(-1), { name: 'New foe', tier: 'standard' });
    assert.deepEqual(me.check(), []);
});

test('a pack with items and no foes can start the bestiary from the items list, and the other way round', () => {
    const me = host({ foes: null });
    me.draw().querySelector('.st-start-other .st-start').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: ['content', 'foes'], value: [{ name: 'New foe', tier: 'standard' }] }]);
    assert.deepEqual(me.went.at(-1), ['items', 'foes.0']);
    assert.equal(me.draw().querySelector('.st-start-other'), null);
    const other = host({ items: null });
    assert.equal(other.draw().querySelector('.st-start-other .st-start').textContent, 'Start the item list');
});

test('a focus on a field marks its control, and a checker problem shows under it and on the record', () => {
    const me = host();
    me.focus = { rec: 'foes.1', path: ['tier'] };
    me.problems = [{ path: 'content.foes[1].tier', message: 'tier must be one of mob.', level: 'error' }, { path: 'content.foes[1]', message: 'two foes share the slug.', level: 'error' }];
    const root = me.draw();
    assert.equal(root.querySelector('[data-key="items"]'), null);
    assert.ok(field(root, 'tier').querySelector('select').classList.contains('st-at'));
    assert.equal(field(root, 'tier').querySelector('.st-problem').textContent, 'tier must be one of mob.');
    assert.equal(root.querySelector('.st-problem[role="status"]').textContent, 'two foes share the slug.');
});

test('a pack that cannot be edited, or a list that is not all records, falls back to the read-only cards', () => {
    const me = host({ extra: { legacy: true } });
    assert.equal(me.draw().querySelector('.st-itemrow'), null);
    installFakeDom();
    const nodes = editSection({ key: 'items', where: 'content', value: ['loose'], count: 1 }, { doc: {}, kind: 'world', legacy: false, problems: [], focus: null, commit: () => ({ ok: true }), keep: () => ({}), go: () => {} });
    assert.equal(nodes[0].querySelector('.st-itemrow'), null);
});

test('the open item\'s data-rec holds its fields: Go to finds the field marked inside the record, as the Studio looks for it', () => {
    const me = host();
    me.focus = { rec: 'items.0', path: ['name'] };
    const record = me.draw().querySelector('[data-rec="items.0"]');
    assert.ok(record.querySelector('.st-at'));
    assert.equal(record.querySelector('.st-at').closest('[data-key]').dataset.key, 'name');
});
