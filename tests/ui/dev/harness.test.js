import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
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
  assert.deepEqual(h.state, { theme: 'light', variant: 'rpgOff', width: 820, tab: 'bag', plan: 'off', fight: 'choose', bag: 'light' });
  assert.equal(frame.style.width, '820px');
  assert.equal(h.suite().tabHost.current(), 'bag');
});

test('falls back on unknown query values', () => {
  const { h } = setup('?theme=neon&variant=x&width=abc');
  assert.deepEqual(h.state, { theme: 'dark', variant: 'default', width: 390, tab: 'now', plan: 'off', fight: 'choose', bag: 'light' });
});

test('controls remount with the chosen switch', () => {
  const { h, controls, frame } = setup();
  assert.equal(controls.querySelectorAll('button').length, 22);
  controls.querySelector('[data-key="variant"][data-value="fightOpen"]').click();
  assert.equal(h.state.variant, 'fightOpen');
  assert.equal(h.suite().tabHost.tabs().includes('fight'), true);
  h.apply({ theme: 'light', width: 360 });
  assert.equal(frame.querySelectorAll('.su-layer').length, 1);
  assert.equal(h.suite().root.getAttribute('data-scheme'), 'light');
  assert.equal(frame.style.width, '360px');
});

test('the Story plan switch rebuilds the Story view-model', async () => {
  const { h } = setup('?tab=story');
  assert.equal(h.port.view('story').plan.shown, false);
  await h.port.command('prefs.spoiler.set', { chatId: 'x', level: 'plan', value: true });
  assert.equal(h.port.view('story').plan.shown, true);
  assert.equal(h.state.plan, 'on');
  assert.ok(h.port.view('story').beats.items.length > 0);
});

test('the fight step and bag load switches reach the fixtures', () => {
  const { h } = setup('?tab=fight&fight=after&bag=heavy&plan=on');
  assert.equal(h.port.view('fight').state, 'after');
  assert.equal(h.port.view('bag').load.level, 'heavy');
  assert.equal(h.port.view('story').plan.shown, true);
  h.apply({ bag: 'over', fight: 'end' });
  assert.equal(h.port.view('bag').load.level, 'over');
  assert.equal(h.port.view('fight').state, 'end');
});

test('the public face exposes the mount, contract and fake port', () => {
  assert.deepEqual(Object.keys(face).sort(), ['PORT_METHODS', 'checkPort', 'createFakePort', 'mountSuite']);
});

test('the fight switch turns off: variant buttons decide again, a fight button sets the fight for that variant', () => {
  const { h } = setup('?fight=end');
  assert.equal(h.state.variant, 'fightOpen');
  h.apply({ variant: 'default' });
  assert.equal(h.suite().tabHost.tabs().includes('fight'), false);
  h.apply({ fight: 'after' });
  assert.equal(h.state.variant, 'fightOpen');
  h.apply({ variant: 'rpgOff' });
  assert.equal(h.suite().tabHost.tabs().includes('fight'), false);
  assert.equal(setup('?fight=end&variant=empty').h.state.variant, 'empty');
});
