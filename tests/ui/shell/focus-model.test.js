// The suite's one focus model (soak #1 and #3): the suite view takes the focus on open and the page behind is inert; the dossier is modal, keeps
// Tab inside it and gives the focus back to the card that opened it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSuiteView } from '../../../ui/shell/suite-view.js';
import { mountSuite } from '../../../ui/mount.js';
import { createFakePort } from '../../../ui/port/fake-port.js';

const el = (doc, tag, attrs = {}) => {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  doc.body.appendChild(node);
  return node;
};
const esc = suite => suite.backStack.handleKeydown({ key: 'Escape', preventDefault() {} });
const tab = (target, shiftKey = false) => target.dispatch('keydown', { key: 'Tab', shiftKey });

test('opening the suite takes the focus and makes the page behind inert; closing gives both back (soak #1)', () => {
  const doc = installFakeDom();
  const sheld = el(doc, 'div', { id: 'sheld' });
  const already = el(doc, 'div', { id: 'held', inert: '' });
  const dialog = el(doc, 'dialog');
  const toasts = el(doc, 'div', { id: 'toast-container' });
  const opener = el(doc, 'button', { id: 'wand' });
  opener.focus();
  const view = createSuiteView({ doc });
  assert.equal(view.open(), true);
  assert.equal(doc.activeElement, view.root, 'the suite has the focus, not the body');
  assert.equal(view.root.getAttribute('tabindex'), '-1');
  assert.equal(sheld.hasAttribute('inert'), true, 'SillyTavern behind the suite is out of reach');
  assert.equal(opener.hasAttribute('inert'), true);
  assert.equal(dialog.hasAttribute('inert'), false, 'a native dialog opened over the suite stays usable');
  assert.equal(toasts.hasAttribute('inert'), false, 'toasts stay readable');
  assert.equal(view.layer.hasAttribute('inert'), false);
  assert.equal(view.close(), true);
  assert.equal(sheld.hasAttribute('inert'), false);
  assert.equal(already.hasAttribute('inert'), true, 'what was inert before stays inert');
  assert.equal(doc.activeElement, opener, 'the focus is back where it was');
  view.open();
  view.destroy();
  assert.equal(sheld.hasAttribute('inert'), false, 'destroyed while open: the page is given back');
});

test('closing the suite leaves the focus alone when it is outside the suite, and skips an opener that left the page', () => {
  const doc = installFakeDom();
  const opener = el(doc, 'button');
  const other = el(doc, 'button');
  opener.focus();
  const view = createSuiteView({ doc });
  view.open();
  other.focus();
  view.close();
  assert.equal(doc.activeElement, other);
  opener.focus();
  view.open();
  opener.remove();
  view.close();
  assert.notEqual(doc.activeElement, opener);
});

test('the dossier is modal: it takes the focus, keeps Tab inside, and Escape gives the focus back to the person card (soak #3)', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  suite.open('people');
  const card = doc.body.querySelector('[data-person-id="torka"]');
  card.focus();
  card.click();
  const dossier = doc.body.querySelector('.dossier');
  assert.equal(dossier.getAttribute('aria-modal'), 'true');
  const back = dossier.querySelector('[data-act="close"]');
  assert.equal(doc.activeElement, back, 'the focus moves into the dossier');
  const controls = dossier.querySelectorAll('button');
  const last = controls.at(-1);
  last.focus();
  assert.equal(tab(last).defaultPrevented, true);
  assert.equal(doc.activeElement, controls[0], 'Tab from the last control comes back to the first');
  assert.equal(tab(controls[0], true).defaultPrevented, true);
  assert.equal(doc.activeElement, last);
  esc(suite);
  assert.equal(doc.body.querySelector('.dossier'), null);
  const now = doc.activeElement;
  assert.ok(now && doc.body.contains(now), 'the focus is on the page, not lost');
  assert.equal(now.dataset.personId, 'torka', 'on the card that opened it');
  assert.equal(now.closest('.su-root') !== null, true);
  suite.destroy();
});

test('a dossier opened from People, closed back to the redrawn People: the focus stays in the suite', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  suite.open('people');
  const link = doc.body.querySelector('[data-person-id="torka"]');
  link.focus();
  link.click();
  doc.body.querySelector('.dossier [data-act="close"]').click();
  assert.equal(suite.tabHost.current(), 'people');
  const now = doc.activeElement;
  assert.ok(now && doc.body.contains(now), 'not left on a removed node');
  assert.ok(now.closest('.su-root'), 'inside the suite');
  suite.destroy();
});
