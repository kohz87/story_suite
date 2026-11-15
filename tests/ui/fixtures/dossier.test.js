import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOSSIERS, TIES, dossierFor } from '../../../ui/fixtures/dossier.js';
import { PEOPLE } from '../../../ui/fixtures/people.js';

test('DOSSIERS covers alive, away, deceased and presumed people', () => {
  assert.deepEqual(Object.keys(DOSSIERS), ['temiwa', 'torka', 'rika', 'marro', 'dren']);
  assert.equal(DOSSIERS.temiwa.life, 'alive');
  assert.equal(DOSSIERS.marro.life, 'deceased');
  assert.equal(DOSSIERS.dren.life, 'presumed');
  assert.equal(DOSSIERS.dren.genderUnknown, true);
  assert.equal(DOSSIERS.temiwa.genderUnknown, false);
});

test('dossier meters, flags and mood come from the shared cast', () => {
  for (const [id, d] of Object.entries(DOSSIERS)) {
    const p = PEOPLE.cast.find(c => c.personId === id);
    assert.deepEqual(d.meters, p.meters);
    assert.equal(d.following, p.followed);
    assert.equal(d.inParty, p.inParty);
  }
});

test('a present person has a live now block and the Scene spoiler; an away one has last-known', () => {
  assert.equal(DOSSIERS.temiwa.now.where, 'by the notice board');
  assert.ok(DOSSIERS.temiwa.scene.wants);
  assert.equal(DOSSIERS.rika.now.lastSeen, '8:00 am');
  assert.equal(DOSSIERS.rika.scene, null);
});

test('only deceased and presumed people have a death card; presumed says so', () => {
  assert.equal(DOSSIERS.temiwa.death, null);
  assert.equal(DOSSIERS.marro.death.certainty, 'confirmed');
  assert.equal(DOSSIERS.dren.death.certainty, 'presumed');
  assert.ok(DOSSIERS.marro.secrets.items[0].open, 'opened secrets stay readable');
});

test('secret counts match the items; locked items carry only the rule', () => {
  for (const d of Object.values(DOSSIERS)) {
    assert.equal(d.secrets.total, d.secrets.items.length);
    assert.equal(d.secrets.opened, d.secrets.items.filter(i => i.open).length);
    for (const i of d.secrets.items.filter(x => !x.open)) assert.equal(i.text, null);
  }
});

test('dossierFor returns a deep copy, or null for an unknown id', () => {
  const a = dossierFor('temiwa');
  a.meters.trust = 99;
  a.profile.habits.push('x');
  assert.equal(DOSSIERS.temiwa.meters.trust, 22);
  assert.equal(DOSSIERS.temiwa.profile.habits.length, 3);
  assert.equal(dossierFor('nobody'), null);
});

test('TIES only link people in the cast', () => {
  const ids = new Set(PEOPLE.cast.map(p => p.personId));
  for (const t of TIES) {
    assert.ok(ids.has(t.a) && ids.has(t.b));
  }
  assert.ok(Object.isFrozen(TIES));
});
