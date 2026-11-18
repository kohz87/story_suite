import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { profilePage, genderWords } from '../../../../../ui/tabs/people/dossier/profile.js';
import { dossier } from './helpers.js';

test('Profile lists Who, Looks, Character with habits, and Background', () => {
  installFakeDom();
  const parts = profilePage(dossier('temiwa'));
  assert.deepEqual(parts.map(p => p.querySelector('.secl').textContent), ['Who', 'Looks', 'Character', 'Background']);
  assert.match(parts[0].textContent, /GenderFemale/);
  assert.equal(parts[2].querySelectorAll('li').length, 3);
});

test('unknown gender is flagged and says only Edit can set it', () => {
  installFakeDom();
  const d = dossier('dren');
  const parts = profilePage(d);
  assert.match(parts[0].textContent, /GenderNot stated · set it in Edit/);
  assert.equal(genderWords(d).className, 'gflag');
  assert.equal(genderWords({ genderUnknown: false, profile: { gender: 'Male' } }), 'Male');
  assert.equal(genderWords({}).className, 'gflag');
});

test('sections with nothing in them are left out', () => {
  installFakeDom();
  const parts = profilePage(dossier('dren'));
  assert.deepEqual(parts.map(p => p.querySelector('.secl').textContent), ['Who']);
  assert.equal(profilePage({}).length, 1);
});

test('SFF4 #7: the Level, the goal, the abilities and the keepsakes NPC State holds show on Profile, from the record through the selector', async () => {
  installFakeDom();
  const { selectDossier } = await import('../../../../../ui/select/dossier.js');
  const vm = selectDossier({ dossier: {
    id: 'npc_rika', name: 'Rika', gender: 'female', level: 5, goal: 'A Guild licence and a crew.',
    abilities: [{ name: 'Raw Bolt', description: 'a bolt of unshaped mana' }, { name: 'Wild Surge', description: '' }],
    keepsakes: [{ name: 'Startrace Travelling Coat', description: 'too big for her' }, { name: '', description: 'nameless' }],
  } });
  const parts = profilePage(vm);
  assert.deepEqual(parts.map(p => p.querySelector('.secl').textContent), ['Who', 'Aims', 'Abilities', 'Keepsakes']);
  assert.match(parts[0].textContent, /Level5/);
  assert.match(parts[1].textContent, /GoalA Guild licence and a crew\./);
  assert.equal(parts[2].textContent, 'AbilitiesRaw Bolta bolt of unshaped manaWild Surge—');
  assert.equal(parts[3].textContent, 'KeepsakesStartrace Travelling Coattoo big for her');
});
