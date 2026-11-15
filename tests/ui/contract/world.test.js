import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { WORLD_SHAPE } from '../../../ui/contract/world.js';
import { worldFor } from '../../../ui/fixtures/world.js';

for (const variant of ['default', 'fightOpen', 'empty']) {
  test(`world fixture matches WORLD_SHAPE (${variant})`, () => {
    assert.deepEqual(checkShape(worldFor(variant), WORLD_SHAPE), []);
  });
}

test('rejects an unknown danger word, trip state and news state', () => {
  const w = worldFor('default');
  w.places[0].danger = 'deadly';
  w.trip.state = 'lost';
  w.news[0].state = 'old';
  const errors = checkShape(w, WORLD_SHAPE);
  assert.ok(errors.some(e => e.startsWith('places[0].danger')));
  assert.ok(errors.some(e => e.startsWith('trip.state')));
  assert.ok(errors.some(e => e.startsWith('news[0].state')));
});

test('trip may be null (no trip planned)', () => {
  const w = worldFor('default');
  w.trip = null;
  assert.deepEqual(checkShape(w, WORLD_SHAPE), []);
});

test('heard stamp from may be null (you were there), but where and when are required', () => {
  const w = worldFor('default');
  const last = w.news.at(-1);
  assert.equal(last.heard[0].from, null);
  assert.deepEqual(checkShape(w, WORLD_SHAPE), []);
  delete w.news[0].heard[0].when;
  assert.ok(checkShape(w, WORLD_SHAPE).some(e => e.startsWith('news[0].heard[0].when')));
});
