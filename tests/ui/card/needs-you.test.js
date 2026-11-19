import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { fixture } from '../../../ui/fixtures/index.js';
import { needsYou } from '../../../ui/card/needs-you.js';
import { makeCtx } from './helpers.js';

test('Needs you lists only actions, with a count, and rows navigate', () => {
  installFakeDom();
  const ctx = makeCtx();
  const needs = needsYou(fixture().now, ctx);
  assert.equal(needs.querySelector('h3').textContent, 'Needs you');
  assert.equal(needs.querySelector('.cnt').textContent, '2');
  assert.equal(needs.querySelectorAll('.rnr').length, 2);
  needs.querySelectorAll('.rnr')[1].click();
  assert.deepEqual(ctx.went, ['party']);
});

test('fight open puts the fight row first and goes to the Fight tab', () => {
  installFakeDom();
  const ctx = makeCtx();
  const needs = needsYou(fixture('fightOpen').now, ctx);
  assert.equal(needs.querySelector('.cnt').textContent, '3');
  const first = needs.querySelector('.rnr');
  assert.equal(first.classList.contains('need-fight'), true);
  assert.match(first.textContent, /Fight open/);
  first.click();
  assert.deepEqual(ctx.went, ['fight']);
});

test('nothing to ask and nothing offered: no card; a row without a target is not a button', () => {
  installFakeDom();
  assert.equal(needsYou(fixture('empty').now, makeCtx()), null);
  assert.equal(needsYou({}, {}), null);
  const card = needsYou({ needsYou: [{ kind: 'points', title: '2 points', detail: null, go: null }] }, {});
  assert.equal(card.querySelector('.rnr').tagName, 'DIV');
});
