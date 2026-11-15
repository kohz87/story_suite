import test from 'node:test';
import assert from 'node:assert/strict';
import { skyFor } from '../../../ui/theme/sky.js';
import { GLASS_DARK, GLASS_LIGHT } from '../../../ui/theme/tokens.js';
import { checkSkin } from '../../../ui/theme/apply.js';

test('skyFor returns distinct gradients across time-of-day bands', () => {
  const bands = [
    skyFor(2, 'dark'),
    skyFor(6, 'dark'),
    skyFor(9.5, 'dark'),
    skyFor(14, 'dark'),
    skyFor(19, 'dark'),
  ];
  assert.equal(new Set(bands).size, 5);
  for (const grad of bands) {
    assert.equal(checkSkin({ '--su-sky': grad }).ok, true);
  }
});

test('skyFor morning matches Glass v5 default sky for dark and light', () => {
  assert.equal(skyFor('09:30', 'dark'), GLASS_DARK['--su-sky']);
  assert.equal(skyFor('9:30 am', 'light'), GLASS_LIGHT['--su-sky']);
  assert.equal(skyFor(undefined, 'dark'), GLASS_DARK['--su-sky']);
  assert.equal(skyFor(null, 'light'), GLASS_LIGHT['--su-sky']);
});

test('skyFor parses 12-hour strings, 24-hour strings, objects and wraps hours', () => {
  assert.equal(skyFor('2:10 pm', 'dark'), skyFor(14, 'dark'));
  assert.equal(skyFor('12:00 am', 'dark'), skyFor(0, 'dark'));
  assert.equal(skyFor('12:00 pm', 'dark'), skyFor(12, 'dark'));
  assert.equal(skyFor({ hour: 22, minute: 15 }, 'light'), skyFor(22, 'light'));
  assert.equal(skyFor({ time: '18:45' }, 'light'), skyFor(18, 'light'));
  assert.equal(skyFor(-2, 'dark'), skyFor(22, 'dark'));
  assert.equal(skyFor(26, 'dark'), skyFor(2, 'dark'));
});
