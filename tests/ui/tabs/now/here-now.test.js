// Desktop layout A: Here now (the left column's light rows), Now without its Here card on desktop, and the desktop watcher reading desk.css's answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { nowTab } from '../../../../ui/tabs/now/now.js';
import { hereNowCard } from '../../../../ui/tabs/now/here-now.js';
import { watchDesk } from '../../../../ui/shell/desk-layout.js';
import { makeCtx } from './helpers.js';

const cardsOf = col => col.children.map(c => c.dataset.card);

test('Here now: one light row per person present, the count, the footnote; no feelings numbers, spoiler or fold', () => {
  installFakeDom();
  const here = fixture().now.here;
  const card = hereNowCard(here, makeCtx());
  assert.equal(card.dataset.card, 'here-now');
  assert.equal(card.querySelector('h3').textContent, 'Here now');
  assert.equal(card.querySelector('.cnt').textContent, `${here.length} people`);
  const rows = card.querySelectorAll('.hp2');
  assert.deepEqual(rows.map(r => r.dataset.personId), here.map(p => p.personId));
  assert.equal(rows[0].querySelector('.nl b').textContent, here[0].name);
  assert.equal(rows[0].querySelector('.wh2').textContent, here[0].where);
  assert.equal(card.querySelectorAll('.fl2').length + card.querySelectorAll('.spo').length + card.querySelectorAll('.more2').length, 0);
  assert.equal(card.querySelector('.foot').textContent, 'Tap someone for what they are doing, wearing and want.');
});

test('Here now: a row opens that person\'s dossier (click, Enter or Space); nobody present draws nothing', () => {
  installFakeDom();
  const ctx = makeCtx();
  const went = [];
  ctx.go = (tab, args) => went.push([tab, args?.personId]);
  const here = fixture().now.here;
  const rows = hereNowCard(here, ctx).querySelectorAll('.hp2');
  rows[1].click();
  rows[0].dispatch('keydown', { key: 'Enter' });
  rows[2].dispatch('keydown', { key: ' ' });
  rows[2].dispatch('keydown', { key: 'a' });
  assert.deepEqual(went, [['people', here[1].personId], ['people', here[0].personId], ['people', here[2].personId]]);
  assert.equal(hereNowCard([], ctx), null);
  assert.equal(hereNowCard(undefined, ctx), null);
});

test('Now on desktop: no Here card (it is Here now); Needs you and Today | This reply, You, pinned', () => {
  installFakeDom();
  const ctx = makeCtx();
  const desk = nowTab(fixture().now, { ...ctx, desk: () => true });
  assert.equal(desk.querySelector('[data-card="here"]'), null);
  const [left, right] = desk.querySelectorAll('.ncol');
  assert.deepEqual(cardsOf(left), ['needs', 'today']);
  assert.deepEqual(cardsOf(right), ['this-turn', 'you', 'pinned']);
  // Phone and tablet: as before.
  const narrow = nowTab(fixture().now, { ...ctx, desk: () => false });
  const [l2, r2] = narrow.querySelectorAll('.ncol');
  assert.deepEqual(cardsOf(l2), ['needs', 'today', 'this-turn', 'you']);
  assert.deepEqual(cardsOf(r2), ['here', 'pinned']);
});

test('watchDesk reads --su-desk from the CSS and calls back only when it flips', () => {
  let flag = '';
  let resize = null;
  const view = {
    getComputedStyle: () => ({ getPropertyValue: name => (name === '--su-desk' ? flag : '') }),
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() { resize = null; } },
  };
  const probe = { ownerDocument: { defaultView: view } };
  const seen = [];
  const desk = watchDesk({ probe, root: {}, onChange: next => seen.push(next) });
  assert.equal(desk.on(), false);
  flag = ' 1';
  resize();
  resize();
  assert.equal(desk.on(), true);
  flag = '';
  resize();
  assert.deepEqual(seen, [true, false]);
  desk.stop();
  assert.equal(resize, null);
});

test('watchDesk without a computed style or ResizeObserver stays off', () => {
  const desk = watchDesk({ probe: {}, root: null });
  assert.equal(desk.on(), false);
  assert.equal(desk.check(), false);
  desk.stop();
});
