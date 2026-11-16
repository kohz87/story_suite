import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { glyph, GLYPHS } from '../../../ui/kit/glyphs.js';

const EXPECTED_TABS = ['now', 'party', 'bag', 'people', 'world', 'journal', 'story', 'scene', 'fight'];
const EXPECTED_SLOTS = ['head', 'armor', 'cloak', 'feet', 'mount', 'weapon', 'offhand', 'accessory', 'bagslot'];

test('GLYPHS includes all tab and slot glyphs as frozen structured data', () => {
  assert.equal(Object.isFrozen(GLYPHS), true);
  for (const name of [...EXPECTED_TABS, ...EXPECTED_SLOTS]) {
    assert.ok(Array.isArray(GLYPHS[name]), `missing glyph ${name}`);
    assert.ok(GLYPHS[name].length > 0, `empty glyph ${name}`);
  }
});

test('glyph builds an SVG element for every entry in GLYPHS without innerHTML', () => {
  installFakeDom();
  for (const name of Object.keys(GLYPHS)) {
    const el = glyph(name);
    assert.equal(el.tagName, 'SVG');
    assert.equal(el.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(el.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(el.getAttribute('aria-hidden'), 'true');
    assert.equal(el.children.length, GLYPHS[name].length);
  }
});

test('glyph supports size, className, fill and accessible label options', () => {
  installFakeDom();
  const el = glyph('now', { size: 18, className: 'tab-ico', fill: 'none', label: 'Home' });
  assert.equal(el.getAttribute('width'), '18');
  assert.equal(el.getAttribute('height'), '18');
  assert.equal(el.className, 'tab-ico');
  assert.equal(el.getAttribute('fill'), 'none');
  assert.equal(el.getAttribute('role'), 'img');
  assert.equal(el.getAttribute('aria-label'), 'Home');
  assert.equal(el.hasAttribute('aria-hidden'), false);
});

test('glyph returns null for unknown glyph names', () => {
  installFakeDom();
  assert.equal(glyph('does-not-exist'), null);
  assert.equal(glyph(''), null);
});
