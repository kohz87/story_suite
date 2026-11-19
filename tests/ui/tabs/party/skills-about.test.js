// Every skill type's row and sheet: the description is the body text; a value the view left out is never printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skillsCard, skillSheet } from '../../../../ui/tabs/party/skills.js';
import { sheetSkills } from '../../../../modules/rpg/sheet-skills.js';
import { makeCtx, sheetEl } from './helpers.js';

const BAD = /null|undefined|NaN/;
const ROWS = [
  { name: 'Slash', about: 'A clean cut.', stat: 'str', type: 'attack', practice: 5 }, { name: 'Guard', about: 'Hold the line.', stat: 'vit', type: 'defence', practice: 5 },
  { name: 'Mend', about: 'Closes wounds.', stat: 'wis', type: 'heal', practice: 5 }, { name: 'Haggle', about: 'Talk the price down.', stat: 'cha', type: 'utility', practice: 0 },
];

test('each skill type: the sheet shows its description under the kind line, and nothing prints null', () => {
  const ctx = makeCtx();
  const member = { id: 'm', name: 'Mo', skills: sheetSkills(ROWS, 5) };
  const card = skillsCard(member, ctx);
  for (const [i, skill] of member.skills.entries()) {
    const row = card.querySelectorAll('.sk')[i];
    assert.doesNotMatch(row.textContent, BAD);
    row.click();
    const sheet = sheetEl();
    assert.equal(sheet.querySelector('.ps-p').textContent, ROWS[i].about);
    assert.doesNotMatch(sheet.textContent, BAD);
    sheet.querySelector('.ps-x')?.click();
    document.body.querySelector('.pty-ov')?.remove();
    assert.equal(skill.about, ROWS[i].about);
  }
  assert.equal(card.querySelectorAll('.sk')[3].querySelector('small').textContent, 'Utility · CHA · story only');
});

test('a skill the view gave no cost, stat, resource, rank or description prints none of them', () => {
  const ctx = makeCtx();
  const sheet = skillSheet({ id: 'm', name: 'Mo' }, { name: 'Bare', kind: 'attack', stat: null, resource: null, cost: null, rank: null, mastery: null, about: null }, ctx);
  assert.doesNotMatch(sheetEl().textContent, BAD);
  assert.equal(sheetEl().querySelector('.ps-p'), null);
  assert.equal(sheetEl().querySelector('.ps-i .ps-s').textContent, '');
  sheet.close();
  const row = skillsCard({ id: 'm', name: 'Mo', skills: [{ name: 'Bare', kind: 'heal', stat: undefined, cost: undefined, rank: undefined, mastery: undefined }] }, ctx).querySelector('.sk');
  assert.doesNotMatch(row.textContent, BAD);
  assert.equal(row.querySelector('small').textContent, 'Heal');
});

test('a free skill reads Story only in the sheet, never "0 Stamina"', () => {
  const ctx = makeCtx();
  skillSheet({ id: 'm', name: 'Mo' }, { name: 'Haggle', kind: 'attack', stat: 'CHA', resource: 'stamina', cost: 0, rank: 'Novice', mastery: 1, about: 'Talk.' }, ctx);
  assert.equal(sheetEl().querySelector('.ps-i .ps-s').textContent, 'CHA · Story only');
});
