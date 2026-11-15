import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderRpgSection } from '../../../../ui/settings/sections/rpg.js';

const setup = (extra = {}) => {
  const doc = installFakeDom();
  const settings = { ...buildSettings(), ...extra };
  const calls = [];
  const ctx = { doc, settings, onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => calls.push(['a', k, l]) };
  const sec = id => settings.sections.find(s => s.id === id);
  const host = nodes => { const d = doc.createElement('div'); for (const n of nodes) d.appendChild(n); return d; };
  return { doc, settings, calls, ctx, sec, host };
};

test('RPG shows its module block, rows and no Custom note at Standard difficulty', () => {
  const { ctx, sec, host } = setup();
  const el = host(renderRpgSection(sec('rpg'), ctx));
  assert.equal(el.querySelectorAll('.mod[data-mod="rpg"]').length, 1);
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('rpg').rows.length);
  assert.equal(el.querySelector('.custom-note'), null);
});

test('a Custom difficulty adds the pointer to Director', () => {
  const { ctx, sec, host } = setup();
  const s = { ...sec('rpg'), rows: sec('rpg').rows.map(r => (r.key === 'rpg.difficulty' ? { ...r, value: 'Custom' } : r)) };
  const el = host(renderRpgSection(s, ctx));
  assert.match(el.querySelector('.custom-note').textContent, /Director › Checks/);
  assert.equal(host(renderRpgSection({ id: 'rpg', name: 'RPG' }, ctx)).querySelector('.custom-note'), null);
});

test('with RPG off the block is greyed (Story only text)', () => {
  const { ctx, sec, host } = setup({ modules: buildSettings({ rpg: false }).modules });
  const el = host(renderRpgSection(sec('rpg'), ctx));
  assert.equal(el.querySelector('.mod').className, 'mod off');
  assert.match(el.querySelector('.mt small').textContent, /Story only/);
});
