import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { skillsCard } from '../../../../ui/tabs/party/skills.js';

// Owner, 20 Nov: "the skill doesn't show their current xp to next mastery".
test('each skill row shows its practice toward the next rank, and Max at the top', () => {
  installFakeDom();
  const member = { id: 'astra', name: 'Astra', skills: [
    { glyph: 'atk', name: 'Flash', kind: 'area', stat: 'AGI', resource: 'stamina', cost: 2, rank: 'Apprentice', mastery: 2, practice: 134, next: { name: 'Adept', at: 200, from: 100, minLevel: 10, levelOk: false } },
    { glyph: 'atk', name: 'Old cut', kind: 'attack', stat: 'STR', resource: 'stamina', cost: 1, rank: 'Legend', mastery: 7, practice: 600, next: null },
  ] };
  const card = skillsCard(member, {});
  const rows = card.querySelectorAll('.sk');
  assert.equal(rows[0].querySelector('.skp').textContent, '34/100');
  assert.match(rows[0].querySelector('.skp').getAttribute('title'), /134 of 200 to Adept \(needs level 10\)/);
  assert.equal(rows[1].querySelector('.skp').textContent, 'Max');
});
