import test from 'node:test';
import assert from 'node:assert/strict';
import { skillsCard, skillSheet } from '../../../../ui/tabs/party/skills.js';
import { makeCtx, flush, commands, sheetEl } from './helpers.js';

test('Skills lists count, kind line, rank pill and a seven-step mastery bar per skill', () => {
  const ctx = makeCtx();
  const card = skillsCard(ctx.party.members[0], ctx);
  assert.equal(card.querySelector('.secl').textContent, 'Skills · 5Edit');
  const rows = card.querySelectorAll('.sk');
  assert.deepEqual(rows.map(r => r.querySelector('b').textContent), ['Iaijutsu', 'Flash', 'Shadow Bolt', 'Mend', 'Shadow Step']);
  assert.equal(rows[0].querySelector('small').textContent, 'Attack · DEX · 1 Stamina');
  assert.equal(rows[2].querySelector('small').textContent, 'Magic attack · INT · 1 Mana');
  assert.equal(rows[4].querySelector('small').textContent, 'Stance · evasion · 1 Stamina each exchange');
  assert.equal(rows[4].classList.contains('stance'), true);
  assert.equal(rows[0].querySelector('.rk').textContent, 'Adept');
  assert.equal(rows[0].querySelectorAll('.mbar i.on').length, 3);
  assert.equal(rows[0].querySelectorAll('.mbar i').length, 7);
  assert.equal(rows[3].querySelectorAll('.mbar i.on').length, 1);
});

test('Skills is left out when the member has none; Edit sends rpg.skill.edit', async () => {
  const ctx = makeCtx();
  assert.equal(skillsCard({ id: 'q', name: 'Q', skills: [] }, ctx), null);
  assert.equal(skillsCard({ id: 'q', name: 'Q' }, ctx), null);
  skillsCard(ctx.party.members[1], ctx).querySelector('.edit').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['rpg.skill.edit', { member: 'brann' }]]);
});

test('tapping a skill opens its sheet with rank, mastery and Edit skill', async () => {
  const ctx = makeCtx();
  skillsCard(ctx.party.members[0], ctx).querySelectorAll('.sk')[0].click();
  const sheet = sheetEl();
  assert.equal(sheet.querySelector('.ps-n').textContent, 'Iaijutsu');
  assert.equal(sheet.querySelector('.ps-s').textContent, 'Astra · Adept');
  assert.match(sheet.querySelector('.ps-i').textContent, /Attack/);
  assert.match(sheet.querySelector('.ps-i').textContent, /DEX · 1 Stamina/);
  assert.match(sheet.querySelector('.ps-kv').textContent, /Adept, mastery 3 of 7/);
  assert.equal(sheet.querySelectorAll('.mbar i.on').length, 3);
  sheet.querySelector('.ps-row .ps-b').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['rpg.skill.edit', { member: 'astra', skill: 'Iaijutsu' }]]);
  assert.equal(sheetEl(), null);
});

test('skillSheet falls back to the kind glyph and shows the raw kind for unknown kinds', () => {
  const ctx = makeCtx();
  const m = { id: 'm', name: 'Mo' };
  const sheet = skillSheet(m, { glyph: 'nope', name: 'Odd', kind: 'weird', stat: 'CHA', resource: 'focus', cost: 2, rank: 'Novice', mastery: 1 }, ctx);
  assert.match(sheetEl().querySelector('.ps-i').textContent, /weird/);
  assert.match(sheetEl().querySelector('.ps-i').textContent, /2 focus/);
  assert.equal(sheetEl().querySelector('.ti svg') !== null, true);
  sheet.close();
});
