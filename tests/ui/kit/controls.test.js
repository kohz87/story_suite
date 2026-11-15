import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { button, chip, toggle, segmented } from '../../../ui/kit/controls.js';

test('button renders variants, icon, pressed state and click handler', () => {
  installFakeDom();
  let clicked = 0;
  const pri = button({ label: 'Save', tone: 'primary', icon: 'quest', onClick: () => { clicked += 1; } });
  assert.equal(pri.tagName, 'BUTTON');
  assert.equal(pri.classList.contains('btn2'), true);
  assert.equal(pri.classList.contains('pri'), true);
  assert.equal(pri.querySelector('svg').tagName, 'SVG');
  assert.equal(pri.textContent, 'Save');
  pri.click();
  assert.equal(clicked, 1);

  const dng = button({ label: 'Remove', tone: 'danger', disabled: true, pressed: false });
  assert.equal(dng.classList.contains('dng'), true);
  assert.equal(dng.hasAttribute('disabled'), true);
  assert.equal(dng.getAttribute('aria-pressed'), 'false');

  const ico = button({ label: 'Zoom in', tone: 'icon', icon: 'plus' });
  assert.equal(ico.classList.contains('ibtn'), true);
  assert.equal(ico.getAttribute('aria-label'), 'Zoom in');
  assert.equal(ico.textContent, '');
});

test('chip renders a non-interactive span for status and a button when interactive', () => {
  installFakeDom();
  const status = chip({ label: '2.5 km/h', tone: 'slow', icon: 'road' });
  assert.equal(status.tagName, 'SPAN');
  assert.equal(status.classList.contains('chip2'), true);
  assert.equal(status.classList.contains('slow'), true);
  assert.equal(status.hasAttribute('aria-pressed'), false);
  assert.equal(status.textContent, '2.5 km/h');

  let hits = 0;
  const filter = chip({ label: 'Worn', pressed: true, onClick: () => { hits += 1; } });
  assert.equal(filter.tagName, 'BUTTON');
  assert.equal(filter.getAttribute('aria-pressed'), 'true');
  filter.click();
  assert.equal(hits, 1);
});

test('toggle switches aria-checked on click and respects disabled', () => {
  installFakeDom();
  const states = [];
  const sw = toggle({ checked: false, label: 'Scene spoilers', onChange: (val) => states.push(val) });
  assert.equal(sw.getAttribute('role'), 'switch');
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  assert.equal(sw.getAttribute('aria-label'), 'Scene spoilers');
  sw.click();
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  sw.click();
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  assert.deepEqual(states, [true, false]);

  const off = toggle({ checked: true, disabled: true, onChange: () => states.push('nope') });
  off.click();
  assert.equal(off.getAttribute('aria-checked'), 'true');
  assert.deepEqual(states, [true, false]);
});

test('segmented supports group and tablist modes, click selection and arrow keys', () => {
  installFakeDom();
  const picked = [];
  const grp = segmented({
    label: 'Lens',
    value: 'warmth',
    items: [['warmth', 'Warmth'], ['trust', 'Trust'], { value: 'desire', label: 'Desire', disabled: true }],
    onChange: (val) => picked.push(val),
  });
  assert.equal(grp.getAttribute('role'), 'group');
  const btns = grp.querySelectorAll('button');
  assert.equal(btns.length, 3);
  assert.equal(btns[0].getAttribute('aria-pressed'), 'true');
  assert.equal(btns[1].getAttribute('aria-pressed'), 'false');
  btns[1].click();
  assert.equal(btns[0].getAttribute('aria-pressed'), 'false');
  assert.equal(btns[1].getAttribute('aria-pressed'), 'true');
  btns[2].click();
  assert.deepEqual(picked, ['trust']);

  btns[1].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(btns[0].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(picked, ['trust', 'warmth']);

  const tabs = segmented({
    role: 'tablist',
    value: 'now',
    items: [{ value: 'now', label: 'Now', icon: 'now' }, { value: 'bag', label: 'Bag', icon: 'bag' }],
  });
  const tabBtns = tabs.querySelectorAll('[role="tab"]');
  assert.equal(tabBtns[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabBtns[1].getAttribute('aria-selected'), 'false');
  tabBtns[1].click();
  assert.equal(tabBtns[0].getAttribute('aria-selected'), 'false');
  assert.equal(tabBtns[1].getAttribute('aria-selected'), 'true');
});
