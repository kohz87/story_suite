import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderModelsSection } from '../../../../ui/settings/sections/models.js';

const setup = (extra = {}) => {
  const doc = installFakeDom();
  const settings = { ...buildSettings(), ...extra };
  const calls = [];
  const ctx = { doc, settings, onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => { calls.push(['a', k, l]); } };
  const sec = id => settings.sections.find(s => s.id === id);
  const host = nodes => { const d = doc.createElement('div'); for (const n of nodes) d.appendChild(n); return d; };
  return { doc, settings, calls, ctx, sec, host };
};

test('Models draws three connection cards, the read-only Story one, the order note, then the call rows', () => {
  const { ctx, sec, host } = setup();
  const el = host(renderModelsSection(sec('models'), ctx));
  const cards = el.querySelectorAll('.cn');
  assert.deepEqual(cards.map(c => c.querySelector('b').textContent), ['Story', 'Quick helpers', 'Background']);
  assert.match(cards[0].querySelector('.sel2').textContent, /read-only/);
  assert.equal(cards[0].querySelector('select'), null);
  assert.equal(cards[2].querySelectorAll('.uses span').length, 4);
  assert.equal(el.querySelector('.scope span').textContent, 'Who goes first');
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('models').rows.length);
});

test('choosing a connection emits its path; extra options are listed after the choice', () => {
  const { ctx, sec, host, calls, settings } = setup();
  settings.connections[1].options = ['Other', 'Fast helper'];
  const el = host(renderModelsSection(sec('models'), ctx));
  const sel = el.querySelector('.cn[data-conn="quick"] select');
  assert.deepEqual(sel.querySelectorAll('option').map(o => o.textContent), ['Fast helper', 'Other']);
  sel.value = 'Other'; sel.dispatch('change');
  assert.deepEqual(calls.at(-1), ['c', 'connections.quick.choice', 'Other']);
});

test('Test sends the action and shows the answer time when the handler returns seconds', async () => {
  const { ctx, sec, host, calls } = setup();
  ctx.onAction = (k, l) => { calls.push(['a', k, l]); return 1.1; };
  const el = host(renderModelsSection(sec('models'), ctx));
  const card = el.querySelector('.cn[data-conn="quick"]');
  card.querySelector('[data-test]').click();
  assert.equal(card.querySelector('.tst2 small').textContent, 'testing…');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(calls.at(-1), ['a', 'connections.quick.test', 'Test']);
  assert.equal(card.querySelector('.tst2 small').textContent, 'answered in 1.1 s');
});

test('Test without an answer falls back to the hint; no connections hides the grid', async () => {
  const { ctx, sec, host } = setup();
  const el = host(renderModelsSection(sec('models'), ctx));
  const card = el.querySelector('.cn[data-conn="story"]');
  card.querySelector('[data-test]').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(card.querySelector('.tst2 small').textContent, 'one tiny call');
  const none = setup({ connections: [] });
  const bare = none.host(renderModelsSection(none.sec('models'), none.ctx));
  assert.equal(bare.querySelector('.conn'), null);
  assert.equal(bare.querySelector('.scope'), null);
});
