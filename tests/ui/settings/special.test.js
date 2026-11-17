import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './sections/mount.js';

const press = (el, label) => el.querySelectorAll('.btn2').find(b => b.textContent === label).click();

test('Models draws three connection cards with the read-only Story one, the order note and the call rows', () => {
  const { page, sec } = mountSettings();
  const el = page('models');
  assert.equal(el.querySelectorAll('.cn').length, 3);
  assert.match(el.querySelector('.cn .sel2').textContent, /read-only/);
  assert.ok(el.querySelector('.scope').textContent.includes('Who goes first'));
  assert.ok(el.querySelectorAll('.sgrp .srow').length >= sec('models').rows.length);
});

test('Test on a connection reports models.test and shows the answer; no connections hides the grid', () => {
  const { page, calls } = mountSettings();
  page('models').querySelector('.cn .tst2 button').click();
  assert.equal(calls.at(-1)[1], 'models.test');
  assert.ok(page('models').querySelector('.cn .tst2 small').textContent.startsWith('answered'));
  const none = mountSettings({ connections: [] });
  assert.equal(none.page('models').querySelectorAll('.cn').length, 0);
});

test('Packs draws the pack, data module and tracker cards; Remove asks first and Keep it cancels', () => {
  const { page, calls } = mountSettings();
  const el = page('packs');
  assert.deepEqual(el.querySelectorAll('.sgrp .gt').slice(0, 3).map(g => g.textContent.replace(/ ·.*/, '')), ['Packs', 'Data modules in this chat', 'Trackers in this chat']);
  assert.equal(el.querySelectorAll('.cfm').length, 0);
  press(el, 'Remove');
  assert.equal(page('packs').querySelectorAll('.cfm').length, 1);
  press(page('packs').querySelector('.cfm'), 'Keep it');
  assert.equal(page('packs').querySelectorAll('.cfm').length, 0);
  press(page('packs'), 'Remove');
  press(page('packs').querySelector('.cfm'), 'Remove');
  assert.equal(calls.at(-1)[1], 'packs.remove');
});

test('pack switches, import buttons and tracker buttons emit their keys', () => {
  const { page, calls } = mountSettings();
  const el = page('packs');
  el.querySelector('.sgrp .sw').click();
  assert.match(calls.at(-1)[1], /^packs\./);
  const file = page('packs').querySelectorAll('input').find(i => i.getAttribute('type') === 'file');
  assert.ok(file && file.getAttribute('multiple') !== null, 'Import opens the same picker the old panel has: pack.json with images, or a .zip');
  press(page('packs'), 'Read from the character’s lorebook'); assert.equal(calls.at(-1)[1], 'packs.lorebook');
  press(page('packs'), 'New tracker'); assert.equal(calls.at(-1)[1], 'trackers.open');
  press(page('packs'), 'From a template'); assert.equal(calls.at(-1)[1], 'trackers.open');
  press(page('packs'), 'Build it in the chat'); assert.equal(calls.at(-1)[1], 'trackers.open');
});

test('Tools shows the sent bars and text, then Problems opens its card and Inspector opens the sheet', () => {
  const { page, calls } = mountSettings();
  const el = page('tools');
  assert.equal(el.querySelectorAll('.brow2').length, 5);
  assert.ok(el.querySelector('pre.sent').textContent.includes('Quest in focus'));
  assert.equal(el.querySelectorAll('[data-card="problems"]').length, 0);
  press(el, 'Show');
  assert.equal(page('tools').querySelectorAll('[data-card="problems"]').length, 1);
  assert.equal(calls.some(c => c[1] === 'tools.problems'), false, 'the page opens its own card; it does not ask the host');
  press(page('tools'), 'Reset Tools to defaults'); assert.deepEqual(calls.at(-1), ['a', 'settings.reset', 'Reset Tools to defaults']);
});

test('without sent or pack data the cards are not drawn and no empty Reset is shown', () => {
  const { page } = mountSettings({ sent: null, packs: { packs: [], modules: [], trackers: { cap: 8, items: [] } } });
  assert.equal(page('tools').querySelector('.brow2'), null);
  assert.equal(page('tools').querySelector('pre.sent'), null);
  assert.equal(page('packs').querySelector('.cfm'), null);
});

test('Models: each card\'s select holds its profiles with the stored one chosen; a pick is sent as models.<id> and kept; the note shows', () => {
  const connections = [
    { id: 'story', name: 'Story', desc: '', choice: 'The chat’s own', value: '', options: [], readOnly: true, usedFor: [] },
    { id: 'quick', name: 'Quick helpers', desc: '', choice: 'Big', value: 'Big', options: [{ value: '', label: 'Same as chat' }, { value: 'Big', label: 'Big' }], note: 'A note.', readOnly: false, usedFor: [] },
    { id: 'background', name: 'Background', desc: '', choice: 'Same as chat', value: '', options: [{ value: '', label: 'Same as chat' }, { value: 'Big', label: 'Big' }], readOnly: false, usedFor: [] },
  ];
  const { page, calls } = mountSettings({ connections });
  const el = page('models');
  const quick = el.querySelectorAll('select')[0];
  assert.deepEqual(quick.querySelectorAll('option').map(o => [o.value, o.textContent]), [['', 'Same as chat'], ['Big', 'Big']]);
  assert.equal(quick.value, 'Big');
  assert.equal(el.querySelector('.cnote').textContent, 'A note.');
  quick.value = '';
  quick.dispatch('change');
  assert.deepEqual(calls.at(-1).slice(1), ['models.quick', '']);
  assert.equal(page('models').querySelectorAll('select')[0].value, '', 'the pick is kept when the page is drawn again');
});

test('Test shows the host\'s answer: the seconds, or why it failed', async () => {
  const answers = [{ ok: true, seconds: 2.5 }, { ok: false, message: 'no key' }];
  const { page } = mountSettings({}, { onAction: () => Promise.resolve(answers.shift()) });
  page('models').querySelector('.cn .tst2 button').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page('models').querySelector('.cn .tst2 small').textContent, 'answered in 2.5 s');
  page('models').querySelectorAll('.cn .tst2 button')[1].click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page('models').querySelectorAll('.cn .tst2 small')[1].textContent, 'failed: no key');
});
