// Settings is a modal window like the suite's sheets (soak bug #2): aria-modal, the × takes the focus, the page behind is inert, Tab stays inside, focus returns.
// And Escape in an open Prompts editor closes the editor, not the whole window (soak bug #8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { renderPrompts } from '../../../ui/settings/prompts.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';

function setup(extra = {}) {
  const doc = installFakeDom();
  const behind = doc.createElement('div');
  const opener = doc.createElement('button');
  doc.body.append(behind, opener);
  opener.focus();
  const ov = createSettingsOverlay({ doc, settings: buildSettings(), ...extra });
  return { doc, behind, opener, ov };
}

test('Settings is aria-modal, takes the focus on its ×, makes the page behind inert, and gives all of it back on close', () => {
  const { doc, behind, opener, ov } = setup();
  assert.equal(ov.el.getAttribute('aria-modal'), 'true');
  const preset = doc.createElement('div');
  preset.setAttribute('inert', '');
  doc.body.appendChild(preset);
  ov.open();
  assert.equal(doc.activeElement.getAttribute('aria-label'), 'Close settings');
  assert.equal(behind.hasAttribute('inert'), true);
  assert.equal(ov.el.hasAttribute('inert'), false);
  ov.close();
  assert.equal(behind.hasAttribute('inert'), false, 'what Settings made inert wakes again');
  assert.equal(preset.hasAttribute('inert'), true, 'what was inert before stays so');
  assert.equal(doc.activeElement, opener, 'focus goes back to the ⚙');
});

test('Tab stays inside Settings: from the last control to the first, Shift+Tab from the first to the last, and from outside back in', () => {
  const { doc, ov } = setup();
  ov.open();
  const items = ov.el.querySelectorAll('button, input, select, textarea, a[href], [tabindex]').filter(n => !n.hasAttribute('hidden') && !n.hasAttribute('disabled'));
  const first = items[0];
  const last = items.at(-1);
  last.focus();
  assert.equal(last.dispatch('keydown', { key: 'Tab' }).defaultPrevented, true);
  assert.equal(doc.activeElement, first);
  assert.equal(first.dispatch('keydown', { key: 'Tab', shiftKey: true }).defaultPrevented, true);
  assert.equal(doc.activeElement, last);
});

test('Escape through the back-stack closes Settings and the focus returns to the opener', () => {
  const backStack = createBackStack();
  const { doc, opener, ov } = setup({ backStack });
  ov.open();
  backStack.pop();
  assert.equal(ov.isOpen(), false);
  assert.equal(doc.activeElement, opener);
});

test('Escape with a Prompts editor open closes the editor first and keeps Settings; the next Escapes go back to the page list and then close Settings', () => {
  const backStack = createBackStack();
  let open = 'feelings';
  const view = { rows: [{ id: 'feelings', key: 'tools.prompt.feelings', label: 'Feelings', hint: 'h', text: 'T', own: false, max: 100 }] };
  const state = { get open() { return open; }, draft: {}, busy: false, notes: {}, setOpen: id => { open = id; ov.show('tools'); }, type() {}, save() {}, reset() {} };
  const { ov } = setup({ backStack, renderSection: section => (section.id === 'tools' ? [renderPrompts(view, state)] : null) });
  ov.open('tools');
  assert.ok(ov.el.querySelector('textarea'), 'the editor is open');
  backStack.pop();
  assert.equal(ov.isOpen(), true, 'Settings stays');
  assert.equal(ov.el.querySelector('textarea'), null, 'the editor closed');
  backStack.pop();
  assert.equal(ov.isOpen(), true, 'back to the list of pages');
  backStack.pop();
  assert.equal(ov.isOpen(), false);
});
