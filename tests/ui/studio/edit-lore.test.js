// The Studio's lore editor: the list (counts, search, filters, New entry, Show all), one entry's form (every field writes one patch), the gate,
// rename of an id, Duplicate and the Delete confirm, "used by", the focus on a field, and the fallback of the JSON row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/lore.js';
import { openDoc } from '../../../studio/model/doc.js';
import { apply } from '../../../studio/model/edits.js';
import { buildRefs } from '../../../studio/model/refs.js';

const LORE = [
    { title: 'Premise', keys: [], constant: true, protected: true, text: 'x'.repeat(960) },
    { title: 'The Veil', id: 'the-veil', keys: ['veil', 'shroud', 'mist', 'fog'], hidden: true, gate: 'fired:storm', writes_fact: 'veil-known', text: 'The veil.' },
    { title: 'Lamp Road', keys: ['lamps'], text: 'Lamps.', extra: 1 },
];
const CAST = [{ id: 'nysseth', name: 'Nysseth', secrets: [{ id: 's', text: 'a', gate: 'learned:lore/the-veil' }] }];

// A host: the document, the kept state and a draw that calls the editor again, as the Studio does after each change.
function host(lore = LORE, extra = {}) {
    installFakeDom();
    const me = { doc: openDoc({ doc: { id: 'w', kind: 'world', content: { lore: structuredClone(lore), cast: structuredClone(CAST) } } }), kept: {}, patches: [], went: [], focus: null, problems: [], refuse: null };
    me.ctx = () => ({ doc: me.doc, kind: 'world', refs: buildRefs(me.doc), problems: me.problems, focus: me.focus, keep: id => (me.kept[id] ??= {}),
        commit: patches => { me.patches.push(patches); if (me.refuse) return { ok: false, refusal: me.refuse }; const result = apply(me.doc, patches); if (result.ok) me.doc = result.doc; return result; },
        go: (part, rec) => me.went.push([part, rec]), ...extra });
    me.draw = () => { const section = { key: 'lore', where: 'content', value: me.doc.doc.content.lore, count: me.doc.doc.content.lore.length }; me.root = editSection(section, me.ctx())[0]; return me.root; };
    me.lore = () => me.doc.doc.content.lore;
    return me;
}
const field = (root, key) => root.querySelector('[data-key="' + key + '"]');
const edit = (input, value) => { input.value = value; input.dispatch('change'); };
const open = (me, index) => { me.draw().querySelectorAll('.st-lorerow')[index].click(); return me.root; };

test('the list shows counts, a line and the flags for each entry, with its token estimate', () => {
    const me = host();
    const root = me.draw();
    assert.match(root.querySelector('.st-counts').textContent, /3 entries · 1 hidden · 1 protected · 1 always sent/);
    const rows = root.querySelectorAll('.st-lorerow');
    assert.equal(rows.length, 3);
    assert.match(rows[0].textContent, /Premise/);
    assert.match(rows[0].textContent, /no keys · about 240 tokens/);
    assert.match(rows[0].textContent, /protected/);
    assert.match(rows[0].textContent, /always sent/);
    assert.match(rows[1].textContent, /keys: veil, shroud, mist \+1/);
    assert.match(rows[1].textContent, /hidden/);
});

test('the filters and the search narrow the list, and the choice survives a redraw', () => {
    const me = host();
    me.problems = [{ path: 'content.lore[2].keys', message: 'bad keys' }];
    let root = me.draw();
    root.querySelector('[data-filter="hidden"]').click();
    assert.deepEqual(me.root.querySelectorAll('.st-lorerow').map(r => r.dataset.rec), ['lore.1']);
    assert.equal(me.draw().querySelectorAll('.st-lorerow').length, 1);
    me.root.querySelector('[data-filter="problems"]').click();
    assert.deepEqual(me.root.querySelectorAll('.st-lorerow').map(r => r.dataset.rec), ['lore.2']);
    assert.match(me.root.querySelector('[data-filter="problems"]').textContent, /Problems · 1/);
    assert.match(me.root.querySelector('.st-lorerow').textContent, /✕ 1/);
    me.root.querySelector('[data-filter="all"]').click();
    const search = me.root.querySelector('input.st-search');
    search.value = 'SHROUD'; search.dispatch('input');
    assert.deepEqual(me.root.querySelectorAll('.st-lorerow').map(r => r.dataset.rec), ['lore.1']);
    search.value = 'zzz'; search.dispatch('input');
    assert.match(me.root.textContent, /No entry matches/);
});

test('a long list shows 40 and then all of them', () => {
    const many = Array.from({ length: 55 }, (_, i) => ({ title: 'E' + i, keys: ['k'], text: 't' }));
    const me = host(many);
    const root = me.draw();
    assert.equal(root.querySelectorAll('.st-lorerow').length, 40);
    root.querySelector('.st-more').click();
    assert.equal(me.root.querySelectorAll('.st-lorerow').length, 55);
    assert.equal(me.root.querySelector('.st-more'), null);
});

test('New entry adds a titled entry at the end and opens it; a second one gets a number', () => {
    const me = host();
    me.draw().querySelector('.st-new').click();
    assert.equal(me.lore().at(-1).title, 'New entry');
    assert.deepEqual(me.patches[0][0].path, ['content', 'lore', 3]);
    assert.match(me.draw().textContent, /Lore entry 4 of 4/);
    me.root.querySelector('.st-back').click();
    me.root.querySelector('.st-new').click();
    assert.equal(me.lore().at(-1).title, 'New entry 2');
});

test('the entry form shows its fields and writes one patch for each change; a cleared option leaves the key out', () => {
    const me = host();
    const root = open(me, 1);
    assert.match(root.textContent, /Lore entry 2 of 3/);
    edit(field(root, 'title').querySelector('input'), 'The Shroud');
    assert.equal(me.lore()[1].title, 'The Shroud');
    me.draw();
    assert.equal(me.lore()[1].title, 'The Shroud');
    const keys = field(me.root, 'keys');
    keys.querySelector('button[aria-label="Remove fog"]').click();
    assert.deepEqual(me.lore()[1].keys, ['veil', 'shroud', 'mist']);
    me.draw();
    const rule = field(me.root, 'logic').querySelector('select');
    assert.deepEqual(rule.querySelectorAll('option').map(o => o.textContent), ['Any of them', 'All of them', 'None of them', 'Not all of them']);
    edit(rule, 'None of them');
    assert.equal(me.lore()[1].logic, 'not any');
    me.draw();
    edit(field(me.root, 'order').querySelector('input'), '5');
    assert.equal(me.lore()[1].order, 5);
    me.draw();
    edit(field(me.root, 'order').querySelector('input'), '');
    assert.equal('order' in me.lore()[1], false);
    me.draw();
    const count = me.patches.length;
    edit(field(me.root, 'order').querySelector('input'), ''); // nothing there to remove: no patch
    assert.equal(me.patches.length, count);
});

test('the flags: always sent and protected set true or drop the key; hidden shows the gate and the fact rows', () => {
    const me = host();
    let root = open(me, 2);
    assert.equal(field(root, 'gate'), null);
    field(root, 'hidden').querySelector('button.sw').click();
    assert.equal(me.lore()[2].hidden, true);
    me.draw();
    assert.ok(field(me.root, 'gate'));
    assert.ok(field(me.root, 'writes_fact'));
    field(me.root, 'protected').querySelector('button.sw').click();
    assert.equal(me.lore()[2].protected, true);
    me.draw();
    field(me.root, 'protected').querySelector('button.sw').click();
    assert.equal('protected' in me.lore()[2], false);
});

test('the gate is checked as it is typed and saved as typed; an empty gate is removed', () => {
    const me = host();
    const root = open(me, 1);
    const gate = field(root, 'gate');
    const box = gate.querySelector('textarea');
    assert.equal(box.value, 'fired:storm');
    box.value = 'learned:nysseth/nothing-here'; box.dispatch('input');
    assert.ok(gate.querySelector('.st-problem'));
    edit(box, 'learned:nysseth/s');
    assert.equal(me.lore()[1].gate, 'learned:nysseth/s');
    me.draw();
    edit(field(me.root, 'gate').querySelector('textarea'), '');
    assert.equal('gate' in me.lore()[1], false);
});

test('the text row counts characters and tokens as it is typed', () => {
    const me = host();
    const root = open(me, 0);
    assert.match(root.querySelector('.st-count').textContent, /960 of 4,000 characters · about 240 tokens/);
    const area = field(root, 'text').querySelector('textarea');
    area.value = 'abcd'; area.dispatch('input');
    assert.match(root.querySelector('.st-count').textContent, /4 of 4,000 characters · about 1 tokens/);
});

test('renaming an id that another record names rewrites those records in the same edit', () => {
    const me = host();
    const root = open(me, 1);
    edit(field(root, 'id').querySelector('input'), 'the-shroud');
    assert.equal(me.lore()[1].id, 'the-shroud');
    assert.equal(me.doc.doc.content.cast[0].secrets[0].gate, 'learned:lore/the-shroud');
    assert.equal(me.patches.length, 1);
    me.draw();
    edit(field(me.root, 'id').querySelector('input'), 'Bad Id');
    assert.equal(me.lore()[1].id, 'the-shroud');
    assert.match(me.root.querySelector('.st-problem[role="status"]').textContent, /not an id/);
    // blanking an id another record names is refused (the gate would dangle), with no edit
    me.draw();
    edit(field(me.root, 'id').querySelector('input'), '');
    assert.equal(me.lore()[1].id, 'the-shroud');
    assert.equal(me.patches.length, 1);
    assert.match(me.root.querySelector('.st-problem[role="status"]').textContent, /A record names this entry by its id/);
});

test('an id with nothing using it is a plain set, and clearing it removes the key', () => {
    const me = host();
    open(me, 2);
    edit(field(me.root, 'id').querySelector('input'), 'lamp-road');
    assert.equal(me.lore()[2].id, 'lamp-road');
    assert.equal(me.patches.length, 1);
    me.draw();
    edit(field(me.root, 'id').querySelector('input'), '');
    assert.equal('id' in me.lore()[2], false);
});

test('Used by lists the records that name the entry, and Go to opens them', () => {
    const me = host();
    const root = open(me, 1);
    const used = root.querySelectorAll('.srow').filter(r => /Go to/.test(r.textContent));
    assert.equal(used.length, 1);
    assert.match(used[0].textContent, /nysseth/);
    used[0].querySelector('button').click();
    assert.deepEqual(me.went, [['cast', 'cast.0']]);
    assert.match(open(host(), 0).textContent, /Give the entry an id/);
});

test('Duplicate copies an entry after it with a new title and no id; Delete asks first, and Keep it cancels', () => {
    const me = host();
    open(me, 1);
    me.root.querySelector('.st-dup').click();
    assert.deepEqual(me.lore().map(e => e.title), ['Premise', 'The Veil', 'The Veil (copy)', 'Lamp Road']);
    assert.equal('id' in me.lore()[2], false);
    me.draw();
    assert.match(me.root.textContent, /Lore entry 3 of 4/);
    me.root.querySelector('.st-del').click();
    assert.equal(me.lore().length, 4);
    me.root.querySelector('.st-keep').click();
    assert.ok(me.root.querySelector('.st-del'));
    me.root.querySelector('.st-del').click();
    me.root.querySelector('.st-sure').click();
    assert.equal(me.lore().length, 3);
    assert.match(me.draw().textContent, /3 entries/);
});

test('a refusal from the commit is shown in the entry and nothing changes', () => {
    const me = host();
    const root = open(me, 0);
    me.refuse = 'This pack cannot be edited.';
    edit(field(root, 'title').querySelector('input'), 'Other');
    assert.match(root.querySelector('.st-problem[role="status"]').textContent, /cannot be edited/);
    assert.equal(me.lore()[0].title, 'Premise');
});

test('a checker problem shows under its field, and Go to on a field marks it; an unknown field goes to the JSON row', () => {
    const me = host();
    me.problems = [{ path: 'content.lore[0].title', message: 'title must be short text.' }];
    me.focus = { rec: 'lore.0', path: ['title'] };
    const root = me.draw();
    assert.match(field(root, 'title').querySelector('.st-problem').textContent, /short text/);
    assert.ok(field(root, 'title').querySelector('input').classList.contains('st-at'));
    // The Studio looks for the marked field inside the record's [data-rec] (Go to, F8) and keeps a box being typed in by it after a redraw.
    // (the list beside it has the entry's row, which carries the same data-rec: the Studio looks in the record pane first)
    assert.equal(root.querySelectorAll('.st-pane-rec [data-rec="lore.0"]').length, 1);
    assert.ok(root.querySelector('.st-pane-rec [data-rec="lore.0"]').querySelector('input.st-at'));
    assert.ok(root.querySelector('.st-pane-rec [data-rec="lore.0"]').querySelector('.st-jsonrow'));
    me.focus = { rec: 'lore.2', path: ['extra'] };
    const json = me.draw();
    assert.match(json.textContent, /Also in this entry, only in the JSON below: extra/);
    assert.ok(json.querySelector('.st-pane-rec [data-rec="lore.2"]').querySelector('.st-jsonin.st-at'));
});

test('a pack with no commit (a format 3 pack) is not offered an editor change', () => {
    const me = host(LORE, { commit: undefined });
    const root = open(me, 0);
    assert.ok(root.querySelector('.st-jsonrow'));
});

test('the gate reads the pack the Studio passes (ctx.doc is the pack itself): a place of the pack is no problem', () => {
    const me = host([{ title: 'Gated', id: 'g', hidden: true, gate: 'place:harbor', text: 't' }]);
    me.doc = openDoc({ doc: { id: 'w', kind: 'world', content: { lore: me.lore().map(entry => ({ ...entry })), places: [{ id: 'harbor', name: 'Harbor' }] } } });
    const base = me.ctx;
    me.ctx = () => ({ ...base(), doc: me.doc.doc, refs: buildRefs(me.doc.doc) });
    const root = open(me, 0);
    assert.doesNotMatch(root.textContent, /not a place of this pack/);
});

test('as in the Studio, where commit draws the page again before it returns: Delete shows the list (nothing armed), New and Duplicate open the new entry', () => {
    const me = host();
    const base = me.ctx;
    me.ctx = () => ({ ...base(), commit: patches => { const result = base().commit(patches); if (result.ok) me.draw(); return result; } });
    let root = open(me, 1);
    root.querySelector('.st-del').click();
    me.draw().querySelector('.st-sure').click();
    assert.equal(me.lore().length, 2);
    assert.equal(me.root.querySelector('.st-sure'), null);
    assert.equal(me.root.querySelectorAll('.st-lorerow').length, 2);
    me.root.querySelector('.st-new').click();
    assert.match(me.root.querySelector('.st-entryhead').textContent, /Lore entry 3 of 3/);
    me.root.querySelector('.st-dup').click();
    assert.match(me.root.querySelector('.st-entryhead').textContent, /Lore entry 4 of 4/);
});

test('a refused New entry leaves the page as it was: the list, its search and its filter', () => {
    const me = host();
    const base = me.ctx;
    me.ctx = () => ({ ...base(), commit: patches => { const result = base().commit(patches); if (result.ok) me.draw(); return result; } });
    me.refuse = 'A pack below format 4 is read-only here.';
    me.draw().querySelector('.st-filter[data-filter="hidden"]').click();
    me.draw().querySelector('.st-new').click();
    const kept = me.kept[Object.keys(me.kept).find(id => 'filter' in me.kept[id])];
    assert.equal(kept.filter, 'hidden');
    assert.equal(kept.open, undefined);
    assert.equal(me.draw().querySelectorAll('.st-lorerow').length, 1);
});
