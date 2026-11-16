import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { h, clear, svgEl } from '../../../ui/kit/dom.js';

test('h builds elements with text, nested arrays and skipped falsy children', () => {
  installFakeDom();
  const el = h(
    'div',
    { id: 'box', class: ['card', null, 'glass'], dataset: { tabId: 'now', skip: false } },
    h('span', 'hello'),
    [null, undefined, false, true, ' world', 42],
  );
  assert.equal(el.tagName, 'DIV');
  assert.equal(el.id, 'box');
  assert.equal(el.className, 'card glass');
  assert.equal(el.dataset.tabId, 'now');
  assert.equal(el.dataset.skip, undefined);
  assert.equal(el.children.length, 1);
  assert.equal(el.textContent, 'hello world42');
});

test('h treats markup strings as literal text nodes and rejects innerHTML', () => {
  installFakeDom();
  const el = h('p', '<img src=x onerror=alert(1)>');
  assert.equal(el.children.length, 0);
  assert.equal(el.textContent, '<img src=x onerror=alert(1)>');
  assert.throws(() => h('div', { innerHTML: '<b>x</b>' }), TypeError);
  assert.throws(() => h('div', { outerHTML: '<b>x</b>' }), TypeError);
});

test('h handles style, boolean attributes, htmlFor, value and event listeners', () => {
  installFakeDom();
  let clicks = 0;
  const btn = h('button', {
    disabled: true,
    hidden: false,
    style: { width: '50%', opacity: 0.5 },
    onClick: () => { clicks += 1; },
  }, 'Go');
  assert.equal(btn.hasAttribute('disabled'), true);
  assert.equal(btn.hasAttribute('hidden'), false);
  assert.equal(btn.style.getPropertyValue('width'), '50%');
  assert.equal(btn.style.getPropertyValue('opacity'), '0.5');
  btn.click();
  assert.equal(clicks, 1);

  const lbl = h('label', { htmlFor: 'name-in', style: 'color:red' }, 'Name');
  assert.equal(lbl.getAttribute('for'), 'name-in');
  assert.equal(lbl.getAttribute('style'), 'color:red');

  const input = h('input', { value: 'Astra' });
  assert.equal(input.value, 'Astra');
  assert.equal(input.getAttribute('value'), 'Astra');
});

test('clear empties element children and ignores nullish input', () => {
  installFakeDom();
  const list = h('ul', h('li', 'one'), h('li', 'two'));
  assert.equal(list.children.length, 2);
  clear(list);
  assert.equal(list.children.length, 0);
  assert.equal(list.textContent, '');
  assert.doesNotThrow(() => clear(null));
});

test('svgEl creates SVG-namespaced elements with attributes and children', () => {
  installFakeDom();
  const svg = svgEl(
    'svg',
    { viewBox: '0 0 24 24', class: ['ico', 'sm'] },
    svgEl('circle', { cx: 12, cy: 12, r: 9 }),
  );
  assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(svg.tagName, 'SVG');
  assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(svg.className, 'ico sm');
  assert.equal(svg.children.length, 1);
  assert.equal(svg.children[0].namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(svg.children[0].tagName, 'CIRCLE');
});
