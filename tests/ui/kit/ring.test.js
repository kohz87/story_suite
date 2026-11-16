import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { feelingsRing, FEELING_KEYS } from '../../../ui/kit/ring.js';

test('feelingsRing draws one arc per non-zero meter and none for zero', () => {
  installFakeDom();
  assert.deepEqual([...FEELING_KEYS], ['trust', 'affection', 'desire', 'tension']);
  const ring = feelingsRing({ trust: 22, affection: 9, desire: 0, tension: -4 });
  assert.equal(ring.querySelectorAll('.ring-track').length, 1);
  const arcs = ring.querySelectorAll('.ring-arc');
  assert.equal(arcs.length, 3);
  assert.deepEqual(arcs.map(a => a.getAttribute('data-meter')), ['trust', 'affection', 'tension']);
  assert.equal(ring.getAttribute('aria-hidden'), 'true');
});

test('feelingsRing dashes negative meters and rounds positive ones', () => {
  installFakeDom();
  const ring = feelingsRing({ trust: 10, tension: -10 }, { width: 8 });
  const [pos, neg] = ring.querySelectorAll('.ring-arc');
  assert.equal(pos.getAttribute('stroke-linecap'), 'round');
  assert.equal(pos.getAttribute('stroke-dasharray'), null);
  assert.equal(neg.getAttribute('stroke-linecap'), 'butt');
  assert.equal(neg.getAttribute('stroke-dasharray'), '7.2 5.6');
  assert.match(pos.getAttribute('d'), /^M[\d.]+ [\d.]+A/);
});

test('feelingsRing copes with empty, bad and oversized values', () => {
  installFakeDom();
  assert.equal(feelingsRing().querySelectorAll('.ring-arc').length, 0);
  assert.equal(feelingsRing({ trust: 'x', affection: NaN }).querySelectorAll('.ring-arc').length, 0);
  const big = feelingsRing({ trust: 500 }).querySelector('.ring-arc');
  const small = feelingsRing({ trust: 100 }).querySelector('.ring-arc');
  assert.equal(big.getAttribute('d'), small.getAttribute('d'));
  assert.match(big.getAttribute('d'), / 0 0 1 /);
});

test('feelingsRing pad moves the radius and ticks adds four quarter marks', () => {
  installFakeDom();
  const ring = feelingsRing({}, { width: 2.6, pad: 4, ticks: true });
  assert.equal(ring.querySelector('.ring-track').getAttribute('r'), '44.7');
  const ticks = ring.querySelectorAll('.ring-tick');
  assert.equal(ticks.length, 4);
  assert.equal(ticks[0].getAttribute('d'), 'M50.00 3.00L50.00 -0.50');
  assert.equal(feelingsRing({}).querySelectorAll('.ring-tick').length, 0);
});
