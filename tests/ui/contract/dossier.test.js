import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { DOSSIER_SHAPE } from '../../../ui/contract/dossier.js';
import { DOSSIERS, dossierFor } from '../../../ui/fixtures/dossier.js';

for (const id of Object.keys(DOSSIERS)) {
  test(`dossier fixture ${id} matches DOSSIER_SHAPE`, () => {
    assert.deepEqual(checkShape(dossierFor(id), DOSSIER_SHAPE), []);
  });
}

test('life only allows alive, deceased or presumed', () => {
  const d = dossierFor('temiwa');
  d.life = 'missing';
  assert.ok(checkShape(d, DOSSIER_SHAPE).some(e => e.startsWith('life')));
});

test('death certainty only allows confirmed or presumed', () => {
  const d = dossierFor('marro');
  d.death.certainty = 'maybe';
  assert.ok(checkShape(d, DOSSIER_SHAPE).some(e => e.startsWith('death.certainty')));
});

test('now accepts the live form or the last-known form, not a mix of wrong types', () => {
  const live = dossierFor('temiwa');
  const away = dossierFor('rika');
  assert.deepEqual(checkShape(live, DOSSIER_SHAPE), []);
  assert.deepEqual(checkShape(away, DOSSIER_SHAPE), []);
  away.now = { lastPlace: 5 };
  assert.ok(checkShape(away, DOSSIER_SHAPE).some(e => e.startsWith('now')));
});

test('change delta must be a number and heldBack a boolean', () => {
  const d = dossierFor('temiwa');
  d.changes[0].delta = '2';
  d.changes[1].heldBack = 'no';
  const errors = checkShape(d, DOSSIER_SHAPE);
  assert.ok(errors.some(e => e.startsWith('changes[0].delta')));
  assert.ok(errors.some(e => e.startsWith('changes[1].heldBack')));
});
