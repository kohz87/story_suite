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
  press(page('packs'), 'Import a pack file'); assert.equal(calls.at(-1)[1], 'packs.import');
  press(page('packs'), 'Read from the character’s lorebook'); assert.equal(calls.at(-1)[1], 'packs.lorebook');
  press(page('packs'), 'New tracker'); assert.equal(calls.at(-1)[1], 'trackers.new');
  press(page('packs'), 'From a template'); assert.equal(calls.at(-1)[1], 'trackers.template');
  press(page('packs'), 'Build it in the chat'); assert.equal(calls.at(-1)[1], 'trackers.chat');
});

test('Tools shows the sent bars and text, then the Inspector and Problems buttons emit actions', () => {
  const { page, calls } = mountSettings();
  const el = page('tools');
  assert.equal(el.querySelectorAll('.brow2').length, 5);
  assert.ok(el.querySelector('pre.sent').textContent.includes('Quest in focus'));
  press(el, 'Open'); assert.equal(calls.at(-1)[1], 'tools.inspector');
  press(page('tools'), 'Show'); assert.equal(calls.at(-1)[1], 'tools.problems');
  press(page('tools'), 'Reset Tools to defaults'); assert.deepEqual(calls.at(-1), ['a', 'settings.reset', 'Reset Tools to defaults']);
});

test('without sent or pack data the cards are not drawn and no empty Reset is shown', () => {
  const { page } = mountSettings({ sent: null, packs: { packs: [], modules: [], trackers: { cap: 8, items: [] } } });
  assert.equal(page('tools').querySelector('.brow2'), null);
  assert.equal(page('tools').querySelector('pre.sent'), null);
  assert.equal(page('packs').querySelector('.cfm'), null);
});
