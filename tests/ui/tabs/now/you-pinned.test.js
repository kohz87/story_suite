import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { youCard, pinnedCards } from '../../../../ui/tabs/now/you-pinned.js';
import { makeCtx } from './helpers.js';

test('You starts folded with a one-line summary and unfolds on click, remembering per device', () => {
  installFakeDom();
  const ctx = makeCtx();
  const you = fixture().now.you;
  const card = youCard(you, ctx);
  assert.equal(card.querySelector('.fold').getAttribute('aria-expanded'), 'false');
  assert.match(card.querySelector('.fold small').textContent, /^Travel leathers under a grey wool cloak · at the counter, half-turned toward Torka$/);
  assert.equal(card.querySelector('.kv2'), null);
  card.querySelector('.fold').click();
  assert.equal(card.querySelector('.fold').getAttribute('aria-expanded'), 'true');
  assert.equal(card.querySelector('p').textContent, you.look);
  assert.match(card.querySelector('.kv2').textContent, /PositionAt the counter/);
  assert.match(card.querySelector('.kv2').textContent, /Condition/);
  assert.equal(ctx.prefs.getFold('now.you', true), false);
  assert.equal(youCard(you, ctx).querySelector('.fold').getAttribute('aria-expanded'), 'true');
  card.querySelector('.fold').click();
  assert.equal(card.querySelector('.kv2'), null);
});

test('You tolerates missing parts and hides when empty', () => {
  installFakeDom();
  const card = youCard({ look: null, position: 'by the door', condition: null }, {});
  assert.equal(card.querySelector('.fold small').textContent, 'by the door');
  card.querySelector('.fold').click();
  assert.equal(card.querySelector('p'), null);
  assert.equal(card.querySelectorAll('dt').length, 1);
  assert.equal(youCard({ look: null, position: null, condition: null }, {}), null);
  assert.equal(youCard(undefined, {}), null);
});

test('pinned trackers get one card each with bars only for fields that have a percent', () => {
  installFakeDom();
  const pinned = fixture().now.pinned;
  const cards = pinnedCards(pinned);
  assert.equal(cards.length, pinned.length);
  assert.equal(cards[0].querySelector('h3').textContent, pinned[0].name);
  assert.equal(cards[0].dataset.trackerId, pinned[0].trackerId);
  assert.equal(cards[0].querySelectorAll('.fld').length, pinned[0].fields.length);
  const withBar = cards[0].querySelectorAll('.fbar').length;
  assert.equal(withBar, pinned[0].fields.filter(f => typeof f.pct === 'number').length);
  const custom = pinnedCards([{ trackerId: 't', name: 'N', fields: [{ label: 'A', value: '5', pct: 250, tone: 'ok' }, { label: 'B', value: 'x' }] }]);
  assert.equal(custom[0].querySelector('.fbar b').style.getPropertyValue('width'), '100%');
  assert.equal(custom[0].querySelector('.fbar b').classList.contains('ok'), true);
  assert.deepEqual(pinnedCards([]), []);
  assert.deepEqual(pinnedCards(undefined), []);
});
