// Contract: the four fields only the harness fixtures fill (secrets[].person, ties[].portrait, skills[].line, profile.likes) are optional keys of the shared shapes, type-checked when present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { STORY_SHAPE } from '../../../ui/contract/story.js';
import { DOSSIER_SHAPE } from '../../../ui/contract/dossier.js';
import { PARTY_SHAPE } from '../../../ui/contract/party.js';
import { buildStory } from '../../../ui/fixtures/story.js';
import { dossierFor } from '../../../ui/fixtures/dossier.js';
import { partyFixture } from '../../../ui/fixtures/party.js';

const errs = (vm, shape, prefix) => checkShape(vm, shape).filter(e => e.startsWith(prefix));

test('secrets[].person: absent, null or a name; a number is rejected', () => {
  const vm = buildStory({ planShown: true });
  const s = vm.secrets.items[0];
  for (const ok of [undefined, null, 'Sister Temiwa']) {
    if (ok === undefined) delete s.person; else s.person = ok;
    assert.deepEqual(errs(vm, STORY_SHAPE, 'secrets'), [], String(ok));
  }
  s.person = 5;
  assert.equal(errs(vm, STORY_SHAPE, 'secrets.items[0].person').length, 1);
});

test('ties[].portrait: absent, null or a URL; a number is rejected', () => {
  const d = dossierFor('temiwa');
  const tie = d.ties[0];
  for (const ok of [undefined, null, 'img/torka.webp']) {
    if (ok === undefined) delete tie.portrait; else tie.portrait = ok;
    assert.deepEqual(errs(d, DOSSIER_SHAPE, 'ties'), [], String(ok));
  }
  tie.portrait = 5;
  assert.equal(errs(d, DOSSIER_SHAPE, 'ties[0].portrait').length, 1);
});

test('profile.likes: absent or a list of strings; a string or a list of numbers is rejected', () => {
  const d = dossierFor('temiwa');
  delete d.profile.likes;
  assert.deepEqual(errs(d, DOSSIER_SHAPE, 'profile'), []);
  d.profile.likes = ['plain bread', 'sea songs'];
  assert.deepEqual(errs(d, DOSSIER_SHAPE, 'profile'), []);
  for (const bad of ['plain bread', [1]]) {
    d.profile.likes = bad;
    assert.equal(errs(d, DOSSIER_SHAPE, 'profile.likes').length, 1, JSON.stringify(bad));
  }
});

test('skills[].line: absent, null or a line; a number is rejected', () => {
  const p = partyFixture();
  const sk = p.members.find(m => m.skills.length).skills[0];
  for (const ok of [undefined, null, 'Melee · DEX · 2 Stamina']) {
    if (ok === undefined) delete sk.line; else sk.line = ok;
    assert.deepEqual(errs(p, PARTY_SHAPE, 'members'), [], String(ok));
  }
  sk.line = 5;
  assert.equal(checkShape(p, PARTY_SHAPE).some(e => /skills\[0\]\.line/.test(e)), true);
});
