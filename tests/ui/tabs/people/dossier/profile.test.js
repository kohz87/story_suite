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
