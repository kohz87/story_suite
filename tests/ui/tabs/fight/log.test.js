import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { logCard } from '../../../../ui/tabs/fight/log.js';
import { makeCtx, fightFixture } from './helpers.js';

test('log: nothing logged gives null', () => {
  installFakeDom();
  assert.equal(logCard(fightFixture('offer')), null);
  assert.equal(logCard(null), null);
});

test('log: while choosing, the earlier exchange is folded to its summary and the order is listed', () => {
  installFakeDom();
  const card = logCard(fightFixture('choose'), makeCtx());
  assert.deepEqual(card.querySelectorAll('.order span').map(s => s.textContent), ['Astra', 'Torka', 'Rika', 'Grey hounds', 'Brann', 'Captain']);
  const fold = card.querySelector('.exb .fold');
  assert.equal(fold.getAttribute('aria-expanded'), 'false');
  assert.match(fold.textContent, /Exchange 1 .*Hound 1 down · Torka hurt/);
  assert.equal(card.querySelector('.exb .fold-body').hasAttribute('hidden'), true);
});

test('log: after an exchange the latest is open with its row count, newest first, older ones folded', () => {
  installFakeDom();
  const card = logCard(fightFixture('after'), makeCtx());
  const exchanges = card.querySelectorAll('.exb');
  assert.deepEqual(exchanges.map(e => e.dataset.exchange), ['2', '1']);
  assert.equal(exchanges[0].querySelector('.fold').getAttribute('aria-expanded'), 'true');
  assert.match(exchanges[0].querySelector('.fold small').textContent, /11 rows/);
  assert.equal(exchanges[1].querySelector('.fold').getAttribute('aria-expanded'), 'false');
});

test('log: a fold opens and closes in place', () => {
  installFakeDom();
  const card = logCard(fightFixture('choose'), makeCtx());
  const fold = card.querySelector('.exb .fold');
  const body = card.querySelector('.exb .fold-body');
  fold.click();
  assert.equal(body.hasAttribute('hidden'), false);
  assert.equal(fold.getAttribute('aria-expanded'), 'true');
  fold.click();
  assert.equal(body.hasAttribute('hidden'), true);
});

test('log: rows show who, what, an outcome chip and the roll maths', () => {
  installFakeDom();
  const card = logCard(fightFixture('end'), makeCtx());
  const rows = card.querySelectorAll('.exb')[0].querySelectorAll('.lr');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector('.who').textContent, 'Start');
  assert.equal(rows[0].classList.contains('up'), true);
  assert.equal(rows[1].querySelector('.oc').textContent, 'HIT');
  assert.equal(rows[1].querySelector('.oc').classList.contains('kS'), true);
  assert.match(rows[1].querySelector('.math').textContent, /^d20 12 \+9 = 21 vs Captain/);
});

test('log: outcome words map to their colour kinds', () => {
  installFakeDom();
  const vm = fightFixture('after');
  const kinds = {};
  for (const row of vm.log.flatMap(l => l.rows)) kinds[row.outcome] = null;
  const card = logCard({ ...vm, state: 'after', log: [{ n: 1, summary: 's', rows: Object.keys(kinds).concat('???').map(o => ({ who: 'x', what: 'y', outcome: o, math: 'm' })) }] }, makeCtx());
  const kind = word => card.querySelectorAll('.oc').find(c => c.textContent === word)?.className.split(' ').find(c => /^k[A-Z]$/.test(c));
  assert.deepEqual(['DECISIVE', 'HIT', 'HIT 1 OF 2', 'MISS', 'MISSES', 'EXTRA', 'NO EXTRA', 'UPKEEP', '4 ATTACKS', '???'].map(kind),
    ['kD', 'kS', 'kS', 'kX', 'kX', 'kT', 'kF', 'kU', 'kC', 'kF']);
  assert.equal(card.querySelectorAll('.lr.lone').length, 1);
});

test('log: what the narrator will be told is folded, kept per device, and left out when there is none', () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = logCard(fightFixture('choose'), ctx);
  const told = card.querySelectorAll('.fold').find(f => /narrator/.test(f.textContent));
  assert.equal(told.getAttribute('aria-expanded'), 'false');
  told.click();
  assert.equal(ctx.prefs.getFold('fight.told', false), true);
  assert.match(card.querySelector('.ntold').textContent, /^At the Auvoth bridge, exchange 1/);
  assert.equal(logCard(fightFixture('choose'), ctx).querySelectorAll('.fold').find(f => /narrator/.test(f.textContent)).getAttribute('aria-expanded'), 'true');
  const none = fightFixture('choose');
  none.narratorTold = null;
  assert.equal(logCard(none, {}).querySelector('.ntold'), null);
});
