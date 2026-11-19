import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { needsList } from '../../../../ui/tabs/journal/needs-list.js';
import { journalTab } from '../../../../ui/tabs/journal/journal.js';
import { createTabHost } from '../../../../ui/shell/tab-host.js';
import { makeCtx } from './needs-helpers.js';

test('Needs you lists only actions, with a count; a row with a target navigates', () => {
  installFakeDom();
  const ctx = makeCtx();
  const needs = needsList(fixture().now.needsYou, ctx);
  assert.equal(needs.querySelector('h3').textContent, 'Needs you');
  assert.equal(needs.querySelector('.cnt').textContent, '2');
  assert.equal(needs.querySelectorAll('.rnr').length, 2);
  needs.querySelectorAll('.rnr')[1].click();
  assert.deepEqual(ctx.went, ['party']);
});

test('the overdue row is not a button here (the quests are listed on this tab); the fight row goes to Fight', () => {
  installFakeDom();
  const ctx = makeCtx();
  const needs = needsList(fixture('fightOpen').now.needsYou, ctx);
  assert.equal(needs.querySelector('.cnt').textContent, '3');
  const first = needs.querySelector('.rnr');
  assert.equal(first.classList.contains('need-fight'), true);
  first.click();
  assert.deepEqual(ctx.went, ['fight']);
  const overdue = needs.querySelector('.rnr.need-overdue');
  assert.equal(overdue.tagName, 'DIV');
});

test('nothing asks: no list; a row without a target is not a button', () => {
  installFakeDom();
  assert.equal(needsList(fixture('empty').now.needsYou, makeCtx()), null);
  assert.equal(needsList(undefined, {}), null);
  assert.equal(needsList([{ kind: 'points', title: '2 points', detail: null, go: null }], {}).querySelector('.rnr').tagName, 'DIV');
});

test('the Journal tab opens with the Needs you list when its view carries rows, and without it when it carries none', () => {
  installFakeDom();
  const journal = fixture().journal;
  const withRows = journalTab({ ...journal, needsYou: fixture().now.needsYou }, makeCtx());
  assert.ok(withRows.querySelector('[data-card="needs"]'));
  assert.equal(withRows.children[0].dataset.card, 'needs', 'it is the top of the tab');
  assert.equal(journalTab({ ...journal, needsYou: [] }, makeCtx()).querySelector('[data-card="needs"]'), null);
});

test('the Journal tab shows a red count of the Needs you rows, and none at 0', () => {
  installFakeDom();
  const host = createTabHost({ flags: { rpg: true, needsCount: 3 } });
  const count = id => host.el.querySelector(`.su-strip [data-tab="${id}"] .su-badge`);
  assert.equal(count('journal').textContent, '3');
  assert.match(count('journal').getAttribute('aria-label'), /3 things need you/);
  assert.equal(count('party'), null, 'only the Journal carries it');
  assert.equal(host.el.querySelector('.su-bar [data-tab="journal"] .su-badge').textContent, '3', 'the phone bar too');
  host.setFlags({ needsCount: 1 });
  assert.match(count('journal').getAttribute('aria-label'), /1 thing needs you/);
  host.setFlags({ needsCount: 0 });
  assert.equal(count('journal'), null, 'hidden at 0');
  assert.equal(host.el.querySelector('.su-badge'), null);
});
