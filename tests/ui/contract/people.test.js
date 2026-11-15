import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { PEOPLE_SHAPE } from '../../../ui/contract/people.js';
import { fixture } from '../../../ui/fixtures/index.js';
import { TIES } from '../../../ui/fixtures/dossier.js';

for (const variant of ['default', 'rpgOff', 'fightOpen', 'empty']) {
  test(`people view-model matches PEOPLE_SHAPE (${variant})`, () => {
    assert.deepEqual(checkShape(fixture(variant).people, PEOPLE_SHAPE), []);
  });
}

test('ties are optional and checked when present', () => {
  const vm = fixture('default').people;
  assert.deepEqual(checkShape({ ...vm, ties: TIES.map(t => ({ ...t })) }, PEOPLE_SHAPE), []);
  const bad = checkShape({ ...vm, ties: [{ a: 'x', b: 'y', kind: 'enemy' }] }, PEOPLE_SHAPE);
  assert.equal(bad.length, 1);
  assert.match(bad[0], /ties\[0\]\.kind/);
});

test('rejects a bad filter, a missing meter and a deceased card without death', () => {
  const vm = structuredClone(fixture('default').people);
  vm.filter = 'everyone';
  delete vm.here[0].meters.trust;
  delete vm.deceased[0].death;
  const errors = checkShape(vm, PEOPLE_SHAPE);
  assert.ok(errors.some(e => e.startsWith('filter')));
  assert.ok(errors.some(e => e.startsWith('here[0].meters.trust')));
  assert.ok(errors.some(e => e.startsWith('deceased[0].death')));
});

test('elsewhere cards need lastPlace, lastSeen and said keys', () => {
  const vm = structuredClone(fixture('default').people);
  delete vm.elsewhere[0].said;
  assert.ok(checkShape(vm, PEOPLE_SHAPE).some(e => e.startsWith('elsewhere[0].said')));
});
