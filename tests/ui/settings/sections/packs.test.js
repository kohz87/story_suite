import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderPacksSection } from '../../../../ui/settings/sections/packs.js';

const setup = (extra = {}) => {
  const doc = installFakeDom();
  const settings = { ...buildSettings(), ...extra };
  const calls = [];
  const ctx = { doc, settings, onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => calls.push(['a', k, l]) };
  const sec = id => settings.sections.find(s => s.id === id);
  const host = nodes => { const d = doc.createElement('div'); for (const n of nodes) d.appendChild(n); return d; };
  return { doc, settings, calls, ctx, sec, host };
};
const PACKS = {
  packs: [{ id: 'ersveil', name: 'Ersveil (open world) 2.9.6', summary: '320 places · 350 routes', on: true }],
  modules: [{ id: 'court', name: 'Court favour', desc: 'no screen', on: true }, { id: 'guild', name: 'Guild membership', desc: 'ranks and dues', on: false }],
  trackers: { items: [{ id: 'debt', name: 'Chapel debt', desc: '3 fields' }], max: 8 },
};

test('Packs draws the pack, data module and tracker cards from ctx.settings.packs', () => {
  const { ctx, sec, host } = setup({ packs: PACKS });
  const el = host(renderPacksSection(sec('packs'), ctx));
  assert.deepEqual(el.querySelectorAll('.sgrp .gt').map(g => g.textContent), ['Packs', 'Data modules in this chat', 'Trackers in this chat · 1 of 8']);
  assert.equal(el.querySelectorAll('[data-pack] .sw').length, 1);
  assert.equal(el.querySelectorAll('.srow.swrow').length, 2);
  assert.equal(el.querySelector('.mod'), null);
});

test('Remove asks first; Keep it cancels, Remove confirms and sends the action', () => {
  const { ctx, sec, host, calls } = setup({ packs: PACKS });
  const el = host(renderPacksSection(sec('packs'), ctx));
  el.querySelector('[data-pack] .dng').click();
  assert.equal(el.querySelector('.cfm b').textContent, 'Remove Ersveil?');
  el.querySelectorAll('.cfm .btn2')[1].click();
  assert.equal(el.querySelector('.cfm'), null);
  el.querySelector('[data-pack] .dng').click();
  el.querySelector('.cfm .dng').click();
  assert.deepEqual(calls.at(-1), ['a', 'packs.ersveil.remove', 'Remove']);
  assert.equal(el.querySelector('.cfm'), null);
  el.querySelector('[data-pack] .dng').click();
  el.querySelector('[data-pack] .dng').click();
  assert.equal(el.querySelector('.cfm'), null);
});

test('switches, import buttons and tracker buttons emit their keys', () => {
  const { ctx, sec, host, calls } = setup({ packs: PACKS });
  const el = host(renderPacksSection(sec('packs'), ctx));
  el.querySelector('[data-pack] .sw').click();
  assert.deepEqual(calls.at(-1), ['c', 'packs.ersveil.on', false]);
  el.querySelectorAll('.swrow .sw')[1].click();
  assert.deepEqual(calls.at(-1), ['c', 'dataModules.guild.on', true]);
  const pressed = label => el.querySelectorAll('.btn2').find(b => b.textContent === label).click();
  pressed('Import a pack file'); assert.deepEqual(calls.at(-1), ['a', 'packs.import', 'Import a pack file']);
  pressed('Read from the character’s lorebook'); assert.equal(calls.at(-1)[1], 'packs.lorebook');
  pressed('Edit fields'); assert.equal(calls.at(-1)[1], 'trackers.debt.edit');
  pressed('New tracker'); assert.equal(calls.at(-1)[1], 'trackers.new');
  pressed('From a template'); assert.equal(calls.at(-1)[1], 'trackers.template');
  pressed('Build it in the chat'); assert.equal(calls.at(-1)[1], 'trackers.chat');
});

test('missing data draws no cards at all, and an empty Reset is not shown', () => {
  const { ctx, sec, host } = setup();
  const el = host(renderPacksSection(sec('packs'), ctx));
  assert.equal(el.querySelectorAll('.sgrp').length, 0);
  assert.equal(el.querySelector('.btn2'), null);
  const some = setup({ packs: { packs: [], modules: [], trackers: { items: [], max: 8 } } });
  assert.equal(some.host(renderPacksSection(some.sec('packs'), some.ctx)).querySelectorAll('.sgrp .gt').length, 1);
});
