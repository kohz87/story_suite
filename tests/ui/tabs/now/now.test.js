import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { nowTab } from '../../../../ui/tabs/now/now.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { NOW_SHAPE } from '../../../../ui/contract/now.js';
import { makeCtx } from './helpers.js';

const orderOf = el => el.querySelectorAll('[data-card]').map(c => [c.dataset.card, Number(/now-o(\d)/.exec(c.className)[1])]);

test('fixture variants all match the Now shape', () => {
  for (const v of ['default', 'rpgOff', 'fightOpen', 'empty']) {
    assert.deepEqual(checkShape(fixture(v).now, NOW_SHAPE), [], v);
  }
});

test('Now holds every card, ordered Right now, Here, This turn, You, Pinned', () => {
  installFakeDom();
  const tab = nowTab(fixture().now, makeCtx());
  assert.equal(tab.dataset.tab, 'now');
  const cards = orderOf(tab);
  assert.deepEqual(cards.map(c => c[0]).sort(), ['here', 'needs', 'pinned', 'this-turn', 'today', 'you']);
  const phone = [...cards].sort((a, b) => a[1] - b[1]).map(c => c[0]);
  assert.deepEqual(phone, ['needs', 'today', 'here', 'this-turn', 'you', 'pinned']);
  assert.equal(tab.querySelectorAll('.ncol').length, 2);
});

test('Now leaves out empty cards and still renders for an empty chat', () => {
  installFakeDom();
  const tab = nowTab(fixture('empty').now, makeCtx());
  assert.deepEqual(tab.querySelectorAll('[data-card]').map(c => c.dataset.card), ['you']);
  assert.equal(nowTab({}, {}).querySelectorAll('[data-card]').length, 0);
  assert.equal(nowTab().querySelectorAll('.ncol').length, 2);
});

test('Story-only Now keeps Needs you to the overdue bill and drops torn gear', () => {
  installFakeDom();
  const tab = nowTab(fixture('rpgOff').now, makeCtx());
  assert.equal(tab.querySelector('[data-card="needs"] .cnt').textContent, '1');
  assert.equal(tab.textContent.includes(' torn'), false);
});

test('Now is built without innerHTML and wires navigation through ctx.go', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = nowTab(fixture().now, ctx);
  tab.querySelector('[data-card="needs"] .rnr').click();
  tab.querySelector('[data-card="today"] .rnr').click();
  assert.deepEqual(ctx.went, ['journal', 'journal']);
});
