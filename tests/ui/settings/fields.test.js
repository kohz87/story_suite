import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { renderRow, renderGroups } from '../../../ui/settings/fields.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';

const base = { key: 'k.x', group: 'G', label: 'Label', hint: null, value: null, default: null, options: null, unit: null, tags: [] };
const row = extra => ({ ...base, ...extra });

test('a switch row shows label, hint and tags, emits on click and toggles from the row', () => {
  installFakeDom();
  const got = [];
  const el = renderRow(row({ type: 'sw', value: true, hint: 'Hint text', tags: ['merged', 'chat', 'bogus'] }), { onChange: (k, v) => got.push([k, v]) });
  assert.ok(el.classList.contains('swrow'));
  assert.equal(el.querySelector('.lb b').textContent, 'Labelmergedthis chat');
  assert.equal(el.querySelector('small').textContent, 'Hint text');
  assert.equal(el.querySelectorAll('.tg2').length, 2);
  const sw = el.querySelector('.sw');
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  assert.equal(sw.getAttribute('aria-labelledby'), 'sf-k.x');
  sw.click();
  el.dispatch('click');
  assert.deepEqual(got, [['k.x', false], ['k.x', true]]);
});

test('a segmented row marks the value, emits the pick, and goes wide when options are long', () => {
  installFakeDom();
  const got = [];
  const el = renderRow(row({ type: 'seg', value: 'B', options: ['A', 'B', 'C'] }), { onChange: (k, v) => got.push(v) });
  assert.equal(el.classList.contains('wide'), false);
  const buttons = el.querySelectorAll('.seg button');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  buttons[2].click();
  assert.deepEqual(got, ['C']);
  const wide = renderRow(row({ type: 'seg', value: 'a', options: ['Rolled from the calendar', 'The story only'] }));
  assert.ok(wide.classList.contains('wide'));
});

test('a number row shows the unit and emits a number, null for blank, and ignores junk', () => {
  installFakeDom();
  const got = [];
  const el = renderRow(row({ type: 'num', value: 5, unit: 'replies' }), { onChange: (k, v) => got.push(v) });
  assert.equal(el.querySelector('.num span').textContent, 'replies');
  const input = el.querySelector('input');
  assert.equal(input.value, '5');
  input.value = '12'; input.dispatch('change');
  input.value = ''; input.dispatch('change');
  input.value = 'abc'; input.dispatch('change');
  assert.deepEqual(got, [12, null]);
});

test('a multi row has one input per key and emits the whole object', () => {
  installFakeDom();
  const got = [];
  const el = renderRow(row({ type: 'multi', value: { Ordinary: 1, Major: 3 } }), { onChange: (k, v) => got.push(v) });
  assert.ok(el.classList.contains('wide'));
  const inputs = el.querySelectorAll('.multi input');
  assert.equal(inputs.length, 2);
  inputs[1].value = '4'; inputs[1].dispatch('change');
  assert.deepEqual(got, [{ Ordinary: 1, Major: 4 }]);
});

test('select and text rows emit their value; a value outside the options is still listed', () => {
  installFakeDom();
  const got = [];
  const sel = renderRow(row({ type: 'sel', value: 'Custom', options: ['A', 'B'] }), { onChange: (k, v) => got.push(v) });
  assert.deepEqual(sel.querySelectorAll('option').map(o => o.textContent), ['Custom', 'A', 'B']);
  const s = sel.querySelector('select');
  s.value = 'B'; s.dispatch('change');
  const txt = renderRow(row({ type: 'txt', value: 'CY' }), { onChange: (k, v) => got.push(v) });
  assert.ok(txt.classList.contains('wide'));
  const t = txt.querySelector('input');
  assert.equal(t.value, 'CY');
  t.value = 'AD'; t.dispatch('change');
  assert.deepEqual(got, ['B', 'AD']);
});

test('chips toggle independently and emit the picked options in order', () => {
  installFakeDom();
  const got = [];
  const el = renderRow(row({ type: 'chips', value: ['Rival'], options: ['Companion', 'Rival', 'Mentor'] }), { onChange: (k, v) => got.push(v) });
  const chips = el.querySelectorAll('.chips3 button');
  assert.equal(chips[1].getAttribute('aria-pressed'), 'true');
  chips[2].click();
  chips[0].click();
  chips[1].click();
  assert.deepEqual(got, [['Rival', 'Mentor'], ['Companion', 'Rival', 'Mentor'], ['Companion', 'Mentor']]);
  assert.equal(chips[1].getAttribute('aria-pressed'), 'false');
});

test('button rows call onAction with the label, and info rows show text only', () => {
  installFakeDom();
  const acts = [];
  const el = renderRow(row({ type: 'btn', options: ['Read and edit', 'Reset to default'] }), { onAction: (k, l) => acts.push([k, l]) });
  el.querySelectorAll('.btn2')[1].click();
  assert.deepEqual(acts, [['k.x', 'Reset to default']]);
  const info = renderRow(row({ type: 'info', value: 'fixed' }));
  assert.equal(info.querySelector('.sinfo').textContent, 'fixed');
  assert.equal(info.querySelectorAll('button,input').length, 0);
  assert.equal(renderRow(row({ type: 'info', value: null })).querySelector('.sinfo').textContent, '');
});

test('renderGroups makes one card per group in first-seen order and handles empty input', () => {
  installFakeDom();
  const look = buildSettings().sections.find(s => s.id === 'look');
  const groups = renderGroups(look.rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].querySelector('.gt').textContent, 'Skin');
  assert.equal(groups[0].querySelectorAll('.srow').length, look.rows.length);
  assert.deepEqual(renderGroups([]), []);
  assert.deepEqual(renderGroups(undefined), []);
  const mixed = renderGroups([row({ group: 'B' }), row({ group: 'A', key: 'a' }), row({ group: 'B', key: 'b' })].map(r => ({ ...r, type: 'info' })));
  assert.deepEqual(mixed.map(g => g.querySelector('.gt').textContent), ['B', 'A']);
  assert.equal(mixed[0].querySelectorAll('.srow').length, 2);
});

test('every fixture row type renders without throwing', () => {
  installFakeDom();
  for (const s of buildSettings().sections) {
    for (const r of s.rows) assert.ok(renderRow(r).classList.contains('srow'), r.key);
  }
});
