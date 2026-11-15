import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { thisTurnCard } from '../../../../ui/tabs/now/this-turn.js';
import { makeCtx } from './helpers.js';

test('lines not applied sort first, a held-back line keeps its reply order, then five rows, then Show all', () => {
  installFakeDom();
  const vm = fixture().now.thisTurn;
  const card = thisTurnCard(vm, makeCtx());
  assert.equal(card.querySelector('.cnt').textContent, '10 changes');
  const rows = card.querySelectorAll('.cr');
  assert.equal(rows.length, 5);
  assert.match(rows[0].textContent, /Sister Temiwa: Trust \+2/);
  assert.match(rows[1].textContent, /Torka: Affection \+1/);
  assert.equal(rows[1].classList.contains('held'), true);
  assert.equal(card.querySelector('.more-btn').textContent, 'Show all 10');
  card.querySelector('.more-btn').click();
  assert.equal(card.querySelectorAll('.cr').length, 10);
});

test('Why reveals asked and why for a held-back line', () => {
  installFakeDom();
  const card = thisTurnCard(fixture().now.thisTurn, makeCtx());
  const why = card.querySelector('.why');
  const text = card.querySelector('.why-text');
  assert.equal(text.hasAttribute('hidden'), true);
  why.click();
  assert.equal(text.hasAttribute('hidden'), false);
  assert.equal(why.getAttribute('aria-expanded'), 'true');
  assert.match(text.textContent, /^asked \+8 · held back: /);
  why.click();
  assert.equal(text.hasAttribute('hidden'), true);
});

test('a line not applied leads, is marked, and explains itself from its detail', () => {
  installFakeDom();
  const card = thisTurnCard(fixture({ notApplied: true }).now.thisTurn, makeCtx());
  const first = card.querySelector('.cr');
  assert.equal(first.classList.contains('w'), true);
  assert.equal(first.querySelector('.why-text').textContent.length > 0, true);
  const plain = thisTurnCard({ count: 1, items: [{ glyph: 'coin', line: 'x', detail: null, applied: false, heldBack: null }] }, {});
  assert.equal(plain.querySelector('.why-text').textContent, 'not applied');
});

test('plain applied rows have no Why; Show all persists as a device fold', () => {
  installFakeDom();
  const ctx = makeCtx();
  const items = Array.from({ length: 6 }, (_, i) => ({ glyph: 'coin', line: `l${i}`, detail: null, applied: true, heldBack: null }));
  const card = thisTurnCard({ count: 6, items }, ctx);
  assert.equal(card.querySelector('.why'), null);
  card.querySelector('.more-btn').click();
  assert.equal(ctx.prefs.getFold('now.turn.all'), true);
  const again = thisTurnCard({ count: 6, items }, ctx);
  assert.equal(again.querySelectorAll('.cr').length, 6);
  assert.equal(thisTurnCard({ count: 1, items: [items[0]] }, {}).querySelector('.cnt').textContent, '1 change');
});

test('an empty reply means no card', () => {
  installFakeDom();
  assert.equal(thisTurnCard(fixture('empty').now.thisTurn, makeCtx()), null);
  assert.equal(thisTurnCard(undefined, {}), null);
});
