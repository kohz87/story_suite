import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderWorldSection } from '../../../../ui/settings/sections/world.js';

const setup = (extra = {}) => {
  const doc = installFakeDom();
  const settings = { ...buildSettings(), ...extra };
  const calls = [];
  const ctx = { doc, settings, onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => calls.push(['a', k, l]) };
  const sec = id => settings.sections.find(s => s.id === id);
  const host = nodes => { const d = doc.createElement('div'); for (const n of nodes) d.appendChild(n); return d; };
  return { doc, settings, calls, ctx, sec, host };
};

test('World and time opens with its module block, then every fixture row, then Reset', () => {
  const { ctx, sec, host } = setup();
  const nodes = renderWorldSection(sec('world'), ctx);
  const el = host(nodes);
  assert.equal(el.querySelectorAll('.mods .mod[data-mod="world"] .msubs').length, 1);
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('world').rows.length);
  assert.ok(el.querySelector('[data-key="world.era"]'));
  assert.match(nodes.at(-1).textContent, /^Reset .* to defaults$/);
});

test('World and time page switch changes the chat module set and reaches onChange', () => {
  const { ctx, sec, host, calls } = setup();
  const el = host(renderWorldSection(sec('world'), ctx));
  el.querySelector('.mh .sw').click();
  assert.deepEqual(calls.at(-1), ['c', 'modules.chat.world.on', false]);
  assert.equal(el.querySelector('.mod').className, 'mod off');
});
