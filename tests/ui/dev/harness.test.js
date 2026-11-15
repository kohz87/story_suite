import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { startHarness } from '../../../ui/dev/harness.js';
import * as face from '../../../ui/index.js';

function setup(search = '') {
  const doc = installFakeDom();
  const controls = doc.createElement('div');
  const frame = doc.createElement('div');
  doc.body.appendChild(controls);
  doc.body.appendChild(frame);
  return { doc, controls, frame, h: startHarness({ doc, search, controls, frame, schedule: fn => fn() }) };
}

test('reads theme, variant, width and tab from the query', () => {
  const { h, frame } = setup('?theme=light&variant=rpgOff&width=820&tab=bag');
  assert.deepEqual(h.state, { theme: 'light', variant: 'rpgOff', width: 820, tab: 'bag' });
  assert.equal(frame.style.width, '820px');
  assert.equal(h.suite().tabHost.current(), 'bag');
});

test('falls back on unknown query values', () => {
  const { h } = setup('?theme=neon&variant=x&width=abc');
  assert.deepEqual(h.state, { theme: 'dark', variant: 'default', width: 390, tab: 'now' });
});

test('controls remount with the chosen switch', () => {
  const { h, controls, frame } = setup();
  assert.equal(controls.querySelectorAll('button').length, 11);
  controls.querySelector('[data-key="variant"][data-value="fightOpen"]').click();
  assert.equal(h.state.variant, 'fightOpen');
  assert.equal(h.suite().tabHost.tabs().includes('fight'), true);
  h.apply({ theme: 'light', width: 360 });
  assert.equal(frame.querySelectorAll('.su-layer').length, 1);
  assert.equal(h.suite().root.getAttribute('data-scheme'), 'light');
  assert.equal(frame.style.width, '360px');
});

test('the public face exposes the mount, contract and fake port', () => {
  assert.deepEqual(Object.keys(face).sort(), ['PORT_METHODS', 'checkPort', 'createFakePort', 'mountSuite']);
});
