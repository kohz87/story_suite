import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderLookSection } from '../../../../ui/settings/sections/look.js';

const setup = (extra = {}) => {
  const doc = installFakeDom();
  const settings = { ...buildSettings(), ...extra };
  const calls = [];
  const ctx = { doc, settings, onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => calls.push(['a', k, l]) };
  const sec = id => settings.sections.find(s => s.id === id);
  const host = nodes => { const d = doc.createElement('div'); for (const n of nodes) d.appendChild(n); return d; };
  return { doc, settings, calls, ctx, sec, host };
};

test('Look shows its four rows in one Skin card, the Follow note and Reset; no module block', () => {
  const { ctx, sec, host } = setup();
  const el = host(renderLookSection(sec('look'), ctx));
  assert.equal(el.querySelectorAll('.sgrp').length, 1);
  assert.equal(el.querySelectorAll('.srow').length, 4);
  assert.equal(el.querySelector('.mod'), null);
  assert.match(el.querySelector('.fine').textContent, /Follow SillyTavern/);
  assert.equal(el.querySelector('.btn2').textContent, 'Reset Look to defaults');
});

test('a skin choice goes through onChange with its key', () => {
  const { ctx, sec, host, calls } = setup();
  const el = host(renderLookSection(sec('look'), ctx));
  el.querySelector('.sseg2 button[data-value="Glass light"]').click();
  assert.deepEqual(calls.at(-1), ['c', 'look.skin', 'Glass light']);
});
