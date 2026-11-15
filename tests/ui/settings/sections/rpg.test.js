import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';

test('RPG shows its module block, rows and no Custom note at Standard difficulty', () => {
  const { page, sec } = mountSettings();
  const el = page('rpg');
  assert.equal(el.querySelectorAll('.mod[data-mod="rpg"]').length, 1);
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('rpg').rows.length);
  assert.equal(el.querySelector('.custom-note'), null);
});

test('a Custom difficulty adds the pointer to Director', () => {
  const base = buildSettings();
  const sections = base.sections.map(s => (s.id === 'rpg' ? { ...s, rows: s.rows.map(r => (r.key === 'rpg.difficulty' ? { ...r, value: 'Custom' } : r)) } : s));
  const { page } = mountSettings({ sections });
  assert.match(page('rpg').querySelector('.custom-note').textContent, /Director › Checks/);
  assert.equal(page('world').querySelector('.custom-note'), null);
});

test('with RPG off the block is greyed (Story only text)', () => {
  const { page } = mountSettings({ modules: buildSettings({ rpg: false }).modules });
  const el = page('rpg');
  assert.equal(el.querySelector('.mod').className, 'mod off');
  assert.match(el.querySelector('.mt small').textContent, /Story only/);
});
