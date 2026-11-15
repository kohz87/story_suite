import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderMoneySection, renderExtrasSection } from '../../../../ui/settings/sections/money-extras.js';

const setup = (extra = {}) => {
  const doc = installFakeDom();
  const settings = { ...buildSettings(), ...extra };
  const calls = [];
  const ctx = { doc, settings, onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => calls.push(['a', k, l]) };
  const sec = id => settings.sections.find(s => s.id === id);
  const host = nodes => { const d = doc.createElement('div'); for (const n of nodes) d.appendChild(n); return d; };
  return { doc, settings, calls, ctx, sec, host };
};

test('Money has its Coins card and Reset but no module block', () => {
  const { ctx, sec, host } = setup();
  const el = host(renderMoneySection(sec('money'), ctx));
  assert.equal(el.querySelector('.mod'), null);
  assert.equal(el.querySelectorAll('.srow').length, sec('money').rows.length);
  assert.equal(el.querySelector('.gt').textContent, 'Coins');
});

test('Chat extras leads with its module block and lists inner chatter rows', () => {
  const { ctx, sec, host } = setup();
  const el = host(renderExtrasSection(sec('extras'), ctx));
  assert.equal(el.querySelectorAll('.mod[data-mod="extras"] .msubs .srow').length, 4);
  assert.equal(el.querySelector('.sgrp .gt').textContent, 'Inner chatter');
  assert.equal(el.querySelectorAll('.sgrp .srow').length, 2);
});
