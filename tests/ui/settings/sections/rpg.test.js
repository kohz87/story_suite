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

test('the Difficulty row says what each choice changes, the chosen one marked', () => {
  const { page } = mountSettings();
  const lines = page('rpg').querySelectorAll('.srow[data-key="rpg.difficulty"] .lb .diff-line');
  assert.deepEqual(lines.map(l => l.textContent), ['Gentle: Foe’s base 2', 'Standard: Foe’s base 4 (the default)', 'Harsh: Foe’s base 6', 'Custom: Your own creation numbers, below', lines[4].textContent]);
  assert.match(lines[4].textContent, /fight board does not use/);
  assert.deepEqual(lines.filter(l => l.className.split(' ').includes('on')).map(l => l.dataset.diff), ['standard']);
});

test('a Custom difficulty adds the note on the numbers it does not show', () => {
  const base = buildSettings();
  const sections = base.sections.map(s => (s.id === 'rpg' ? { ...s, rows: s.rows.map(r => (r.key === 'rpg.difficulty' ? { ...r, value: 'Custom' } : r)) } : s));
  const { page } = mountSettings({ sections });
  assert.match(page('rpg').querySelector('.custom-note').textContent, /fight board does not use them/);
  assert.equal(page('world').querySelector('.custom-note'), null);
});

test('with RPG off the block is greyed (Story only text)', () => {
  const { page } = mountSettings({ modules: buildSettings({ rpg: false }).modules });
  const el = page('rpg');
  assert.equal(el.querySelector('.mod').className, 'mod off');
  assert.match(el.querySelector('.mt small').textContent, /Story only/);
});
