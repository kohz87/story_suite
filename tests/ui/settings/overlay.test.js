import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';

const settings = buildSettings();
const make = (extra = {}) => {
  const doc = installFakeDom();
  const ov = createSettingsOverlay({ doc, settings, subtitle: 'this chat: Ersveil · Astra', ...extra });
  return { doc, ov };
};
const page = ov => ov.el.querySelector('.sbody').getAttribute('data-page');

test('mounts hidden with a header, the nav, and the first section on the page', () => {
  const { ov } = make();
  assert.equal(ov.el.hasAttribute('hidden'), true);
  assert.equal(ov.isOpen(), false);
  assert.equal(ov.el.querySelector('.shd b').textContent, 'Story Suite · Settings');
  assert.equal(ov.el.querySelector('.shd small').textContent, 'this chat: Ersveil · Astra');
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'Start');
  assert.ok(ov.el.querySelector('.sfoot'), 'the footer meter comes from the view-model');
});

test('open and close show and hide, call onClose once and ignore repeats', () => {
  let closed = 0;
  const { ov } = make({ onClose: () => { closed += 1; } });
  assert.equal(ov.open(), true);
  assert.equal(ov.open(), false);
  assert.equal(ov.el.hasAttribute('hidden'), false);
  assert.equal(ov.close(), true);
  assert.equal(ov.close(), false);
  assert.equal(closed, 1);
  ov.el.querySelector('.x').click();
  assert.equal(closed, 1);
});

test('the side nav switches section and marks it current; unknown ids are refused', () => {
  const { ov } = make();
  ov.open();
  ov.el.querySelector('button.si3[data-sec="look"]').click();
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'Look');
  assert.equal(ov.el.querySelector('button.si3[data-sec="look"]').getAttribute('aria-current'), 'true');
  assert.equal(ov.el.querySelectorAll('.spage .srow').length, 5);
  assert.equal(ov.show('nope'), false);
  assert.equal(ov.show('rpg'), true);
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'RPG and fights');
});

test('open(id) lands on that section; renderSection can take over the page and falls back on null', () => {
  const seen = [];
  const { ov } = make({
    renderSection: (s, ctx) => { seen.push([s.id, typeof ctx.onChange, typeof ctx.go]); return s.id === 'models' ? globalThis.document.createElement('p') : null; },
  });
  ov.open('models');
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'Models');
  assert.equal(ov.el.querySelectorAll('.spage .srow').length, 0);
  ov.show('look');
  assert.equal(ov.el.querySelectorAll('.spage .srow').length, 5);
  assert.ok(seen.some(x => x[0] === 'models' && x[2] === 'function'));
});

test('row changes and button actions reach the callbacks with the row key', () => {
  const got = [];
  const { ov } = make({ onChange: (k, v) => got.push(['c', k, v]), onAction: (k, l) => got.push(['a', k, l]) });
  ov.open('look');
  ov.el.querySelector('.srow[data-key="look.sendingNote"] .sw').click();
  ov.show('tools');
  ov.el.querySelectorAll('.srow[data-key="tools.arcPrompt"] .btn2')[1].click();
  assert.deepEqual(got, [['c', 'look.sendingNote', false], ['a', 'tools.arcPrompt', 'Reset to default']]);
});

test('typing a query shows search results and clears the section mark; clearing returns', () => {
  const { ov } = make();
  ov.open('look');
  const box = ov.el.querySelector('.snav input');
  box.value = 'pulse'; box.dispatch('input');
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'Search');
  assert.ok(ov.el.querySelectorAll('.spage .sgrp').length >= 2);
  assert.equal(ov.el.querySelectorAll('button.si3').filter(b => b.getAttribute('aria-current') === 'true').length, 0);
  assert.equal(ov.el.querySelector('.phonelist input').value, 'pulse');
  box.value = ''; box.dispatch('input');
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'Look');
  ov.setQuery('zzzz');
  assert.equal(ov.el.querySelector('.spage .fine').textContent, 'Nothing found.');
});

test('phone flow: list first, a pick opens the section, ‹ Settings returns to the list', () => {
  const { ov } = make();
  ov.open();
  assert.equal(page(ov), 'list');
  ov.el.querySelector('.phonelist button[data-sec="world"]').click();
  assert.equal(page(ov), 'section');
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'World and time');
  ov.el.querySelector('.sback').click();
  assert.equal(page(ov), 'list');
  ov.setQuery('skin');
  assert.equal(page(ov), 'section');
});

test('Escape steps back (section → list, search → list) before it closes the overlay', () => {
  const backStack = createBackStack();
  const { doc, ov } = make({ backStack });
  const unbind = backStack.bindDocument(doc);
  ov.open();
  assert.equal(backStack.hasLayer('settings'), true);
  ov.el.querySelector('.phonelist button[data-sec="look"]').click();
  assert.equal(page(ov), 'section');
  backStack.pop();
  assert.equal(page(ov), 'list');
  assert.equal(ov.isOpen(), true);
  ov.setQuery('skin');
  backStack.pop();
  assert.equal(ov.el.querySelector('.snav input').value, '');
  assert.equal(ov.isOpen(), true);
  backStack.pop();
  assert.equal(ov.isOpen(), false);
  assert.equal(backStack.size(), 0);
  unbind();
});

test('closing by hand releases the back-stack entry', () => {
  const backStack = createBackStack();
  const { ov } = make({ backStack });
  ov.open();
  ov.close();
  assert.equal(backStack.size(), 0);
});

test('the footer meter shows tokens and opens Tools on click', () => {
  const { ov } = make({ sent: { used: 551, cap: 1500, total: 8347 } });
  ov.open();
  const foot = ov.el.querySelector('.sfoot');
  assert.equal(foot.querySelector('.v').textContent, '551 of 1,500 tokens');
  assert.equal(foot.querySelector('.mb2 b').style.getPropertyValue('width'), '37%');
  assert.ok(foot.textContent.includes('8,347 in all'));
  foot.click();
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'Tools');
  assert.equal(page(ov), 'section');
});

test('destroy removes the overlay, and open afterwards does nothing', () => {
  const { doc, ov } = make();
  ov.open();
  ov.destroy();
  assert.equal(doc.body.querySelector('.sov'), null);
  assert.equal(ov.open(), false);
  ov.destroy();
});

test('an empty view-model still mounts', () => {
  const doc = installFakeDom();
  const ov = createSettingsOverlay({ doc });
  assert.equal(ov.open(), true);
  assert.equal(ov.el.querySelectorAll('.spage .sgrp').length, 0);
});
