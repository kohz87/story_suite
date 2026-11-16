import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { bars, expBar } from '../../../ui/kit/bars.js';

const HP = { kind: 'hp', value: 12, max: 14 };

test('bars draws three labelled bars with percentage widths', () => {
  installFakeDom();
  const el = bars([HP, { kind: 'mp', value: 14, max: 14 }, { kind: 'sp', value: 12, max: 15 }]);
  assert.equal(el.className, 'bars3');
  assert.equal(el.children.length, 3);
  assert.match(el.textContent, /Health 12\/14/);
  assert.match(el.textContent, /Mana 14\/14/);
  assert.match(el.textContent, /Stamina 12\/15/);
  const fills = el.querySelectorAll('.fill');
  assert.equal(fills[0].style.getPropertyValue('width'), '86%');
  assert.equal(fills[1].style.getPropertyValue('width'), '100%');
  assert.equal(fills[2].style.getPropertyValue('width'), '80%');
});

test('bars returns null for empty, missing or unknown input', () => {
  installFakeDom();
  assert.equal(bars([]), null);
  assert.equal(bars(null), null);
  assert.equal(bars(undefined), null);
  assert.equal(bars([{ kind: 'zz', value: 1, max: 2 }]), null);
});

test('bars clamps overflow and negative values and survives a zero max', () => {
  installFakeDom();
  const el = bars([
    { kind: 'hp', value: 30, max: 14 },
    { kind: 'mp', value: -4, max: 14 },
    { kind: 'sp', value: 3, max: 0 },
  ]);
  const widths = el.querySelectorAll('.fill').map(f => f.style.getPropertyValue('width'));
  assert.deepEqual(widths, ['100%', '0%', '0%']);
});

test('bars never turns text into markup', () => {
  installFakeDom();
  const el = bars([{ kind: 'hp', value: '<b>x</b>', max: 10 }]);
  assert.equal(el.querySelectorAll('.fill')[0].style.getPropertyValue('width'), '0%');
  assert.match(el.textContent, /<b>x<\/b>\/10/);
});

test('expBar draws a thin accent bar and describes it', () => {
  installFakeDom();
  const el = expBar({ value: 62, max: 100 });
  assert.equal(el.getAttribute('aria-label'), 'EXP 62 of 100');
  assert.equal(el.querySelector('.fill').style.getPropertyValue('width'), '62%');
  assert.ok(el.querySelector('.fill').className.includes('exp'));
});

test('expBar returns null without usable data', () => {
  installFakeDom();
  assert.equal(expBar(null), null);
  assert.equal(expBar({ value: 1, max: 0 }), null);
  assert.equal(expBar({ value: 1 }), null);
});
