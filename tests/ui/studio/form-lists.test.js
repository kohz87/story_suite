// The Studio's list-shaped form pieces: the chip list, the sub-record list, the id picker sheet and the gate field.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { chipList } from '../../../studio/form/list.js';
import { subRecords } from '../../../studio/form/records.js';
import { openPicker } from '../../../studio/form/pick.js';
import { gateField } from '../../../studio/form/gate.js';

const WORLD = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
const type = (input, text, key = 'Enter') => { input.value = text; input.dispatch('keydown', { key }); };

test('a chip list adds on Enter, trims, skips blanks and repeats, and removes by chip', () => {
    installFakeDom();
    const got = [];
    const row = chipList({ key: 'keys', label: 'Keys', values: ['a'], placeholder: 'Add a key…' }, (key, values) => got.push([key, values]));
    const add = () => row.querySelector('input.kadd');
    type(add(), '  b  '); type(add(), ''); type(add(), 'a');
    assert.deepEqual(got, [['keys', ['a', 'b']]]);
    assert.deepEqual(row.querySelectorAll('.kc').map(c => c.textContent), ['a×', 'b×']);
    row.querySelector('button[aria-label="Remove a"]').click();
    assert.deepEqual(got.at(-1), ['keys', ['b']]);
    row.querySelector('button[aria-label="Remove b"]').click();
    assert.equal(row.querySelector('.none').textContent, 'None');
    assert.deepEqual(got.at(-1), ['keys', []]);
});

test('a chip list also adds when the box loses focus with text in it', () => {
    installFakeDom();
    const got = [];
    const row = chipList({ key: 'k', label: 'K' }, (key, values) => got.push(values));
    const box = row.querySelector('input.kadd'); box.value = 'x'; box.dispatch('change');
    assert.deepEqual(got, [['x']]);
});

test('a sub-record list shows a count, disables the end moves, and reports add, move and remove by index', () => {
    installFakeDom();
    const got = [];
    const group = subRecords({ title: 'Ties', addLabel: '+ Add a tie', items: [{ title: 'Torka', sub: 'friend' }, { title: 'Livia' }, { title: 'Hasse' }] },
        { add: () => got.push('add'), move: (at, step) => got.push(['move', at, step]), remove: at => got.push(['remove', at]) });
    assert.equal(group.querySelector('.gt').textContent, 'Ties · 3');
    assert.equal(group.querySelector('button[aria-label="Move Torka up"]').hasAttribute('disabled'), true);
    assert.equal(group.querySelector('button[aria-label="Move Hasse down"]').hasAttribute('disabled'), true);
    assert.equal(group.querySelector('button[aria-label="Move Livia up"]').hasAttribute('disabled'), false);
    group.querySelector('button[aria-label="Move Livia down"]').click();
    group.querySelector('button[aria-label="Remove Torka"]').click();
    group.querySelector('.addrow button').click();
    assert.deepEqual(got, [['move', 1, 1], ['remove', 0], 'add']);
});

test('the picker filters by what is typed, refuses a disabled row, and closes after a pick', () => {
    installFakeDom();
    const items = [{ id: 'nysseth', label: 'Nysseth', sub: 'companion' }, { id: 'livia', label: 'Livia', sub: 'figure', disabled: true, tag: 'tied' }, { id: 'hasse', label: 'Hasse' }];
    const picked = [];
    const sheet = openPicker({}, { title: 'Pick a person', items }, id => picked.push(id));
    const rows = () => sheet.el.querySelectorAll('.slist button');
    assert.equal(rows().length, 3);
    const search = sheet.el.querySelector('input.psrch');
    search.value = 'LIV'; search.dispatch('input');
    assert.deepEqual(rows().map(r => r.dataset.id), ['livia']);
    assert.equal(rows()[0].querySelector('.tg2').textContent, 'tied');
    rows()[0].click();
    assert.deepEqual(picked, []);
    search.value = 'has'; search.dispatch('input');
    rows()[0].click();
    assert.deepEqual(picked, ['hasse']);
    assert.equal(globalThis.document.querySelector('.sh-ov'), null);
});

test('the gate field checks as you type, keeps the text, and commits on change', () => {
    installFakeDom();
    const got = [];
    const content = WORLD.content;
    const row = gateField({ key: 'gate', label: 'Gate', value: 'fired:nothing-like-this', content }, (key, text) => got.push([key, text]));
    assert.ok(row.querySelector('.st-problem'), 'a bad gate shows its problem on first draw');
    const area = row.querySelector('textarea');
    area.value = '  place:no-such-place-here  '; area.dispatch('input');
    assert.ok(row.querySelector('.st-problem').textContent.length > 0);
    assert.equal(area.getAttribute('aria-invalid'), 'true');
    area.value = ''; area.dispatch('input');
    assert.equal(row.querySelector('.st-problem'), null);
    assert.equal(area.getAttribute('aria-invalid'), null);
    area.value = 'place:no-such-place-here  '; area.dispatch('change');
    assert.deepEqual(got, [['gate', 'place:no-such-place-here']]);
});

test('a gate Ersveil already uses shows no problem', () => {
    installFakeDom();
    const secret = WORLD.content.cast.flatMap(p => (p.secrets ?? []).filter(s => s.gate).map(s => ({ gate: s.gate, owner: p.id })))[0];
    const row = gateField({ key: 'gate', label: 'Gate', value: secret.gate, content: WORLD.content, ownerId: secret.owner });
    assert.equal(row.querySelector('.st-problem'), null);
});
