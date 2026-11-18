import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { fieldRow, setProblem } from '../../../studio/form/fields.js';

const spec = extra => ({ key: 'k', label: 'Label', hint: 'Hint', ...extra });
const run = (extra) => {
    installFakeDom();
    const got = [];
    const row = fieldRow(spec(extra), (key, value, s) => got.push([key, value, s.type]));
    return { row, got };
};

test('a text row shows label and hint and reports the committed text', () => {
    const { row, got } = run({ type: 'text', value: 'a' });
    assert.equal(row.querySelector('small').textContent, 'Hint');
    const input = row.querySelector('input.txt2');
    assert.equal(input.value, 'a');
    input.value = 'b'; input.dispatch('change');
    assert.deepEqual(got, [['k', 'b', 'text']]);
});

test('a long text row is a wide textarea that keeps line breaks', () => {
    const { row, got } = run({ type: 'long', value: 'one\ntwo' });
    assert.ok(row.classList.contains('wide'));
    const area = row.querySelector('textarea');
    assert.equal(area.value, 'one\ntwo');
    area.value = 'one\ntwo\nthree'; area.dispatch('change');
    assert.deepEqual(got, [['k', 'one\ntwo\nthree', 'long']]);
});

test('a number row gives a number, null for blank, and ignores junk', () => {
    const { row, got } = run({ type: 'number', value: 3, unit: 'km' });
    const input = row.querySelector('input');
    for (const v of ['7', '', 'abc']) { input.value = v; input.dispatch('change'); }
    assert.deepEqual(got.map(g => g[1]), [7, null]);
    assert.equal(row.querySelector('.num span').textContent, 'km');
});

test('a select row lists the options, keeps an unknown current value, and reports the pick', () => {
    const { row, got } = run({ type: 'select', value: 'old', options: ['a', 'b'] });
    const sel = row.querySelector('select.sel2');
    assert.deepEqual(sel.querySelectorAll('option').map(o => o.textContent), ['old', 'a', 'b']);
    sel.value = 'b'; sel.dispatch('change');
    assert.deepEqual(got, [['k', 'b', 'select']]);
});

test('a toggle row reports the flipped value and a segmented row the picked option', () => {
    const t = run({ type: 'toggle', value: false });
    t.row.querySelector('.sw').click();
    assert.deepEqual(t.got, [['k', true, 'toggle']]);
    const s = run({ type: 'segmented', value: 'A', options: ['A', 'B'] });
    s.row.querySelectorAll('button')[1].click();
    assert.deepEqual(s.got, [['k', 'B', 'segmented']]);
});

test('an inline problem shows under the control, marks it invalid, replaces itself and clears', () => {
    const { row } = run({ type: 'text', value: 'x', problem: 'Needs an id' });
    assert.equal(row.querySelector('.st-problem').textContent, 'Needs an id');
    assert.ok(row.classList.contains('bad'));
    assert.equal(row.querySelector('input').getAttribute('aria-invalid'), 'true');
    setProblem(row, 'Too long');
    assert.equal(row.querySelectorAll('.st-problem').length, 1);
    assert.equal(row.querySelector('.st-problem').textContent, 'Too long');
    setProblem(row, '');
    assert.equal(row.querySelector('.st-problem'), null);
    assert.equal(row.classList.contains('bad'), false);
    assert.equal(row.querySelector('input').getAttribute('aria-invalid'), null);
});
