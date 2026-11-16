import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { rightNow } from '../../../../ui/tabs/now/right-now.js';
import { makeCtx } from './helpers.js';

test('Needs you lists only actions, with a count, and rows navigate', () => {
  installFakeDom();
  const ctx = makeCtx();
  const [needs, today] = rightNow(fixture().now, ctx);
  assert.equal(needs.querySelector('h3').textContent, 'Needs you');
  assert.equal(needs.querySelector('.cnt').textContent, '2');
  assert.equal(needs.querySelectorAll('.rnr').length, 2);
  assert.equal(today.querySelector('h3').textContent, 'Today');
  needs.querySelectorAll('.rnr')[1].click();
  assert.deepEqual(ctx.went, ['party']);
});

test('fight open puts the fight row first and goes to the Fight tab', () => {
  installFakeDom();
  const ctx = makeCtx();
  const [needs, today] = rightNow(fixture('fightOpen').now, ctx);
  assert.equal(needs.querySelector('.cnt').textContent, '3');
  const first = needs.querySelector('.rnr');
  assert.equal(first.classList.contains('need-fight'), true);
  assert.match(first.textContent, /Fight open/);
  first.click();
  assert.deepEqual(ctx.went, ['fight']);
  assert.match(today.textContent, /On the road to Auvoth/);
});

test('Today shows focus, trip with progress, due soon and torn gear (RPG only)', () => {
  installFakeDom();
  const [, today] = rightNow(fixture().now, makeCtx());
  const rows = today.querySelectorAll('.rnr');
  assert.equal(rows.length, 4);
  assert.match(rows[0].textContent, /Missing boatman/);
  assert.match(rows[1].textContent, /Trip to Auvoth · planned/);
  assert.equal(rows[1].querySelector('.lp b').style.getPropertyValue('width'), '0%');
  assert.match(rows[3].textContent, / torn/);
  const [, rpgOff] = rightNow(fixture('rpgOff').now, makeCtx());
  assert.equal(rpgOff.querySelectorAll('.rnr').length, 3);
});

test('empty cards are left out; rows without a target are not buttons', () => {
  installFakeDom();
  assert.deepEqual(rightNow(fixture('empty').now, makeCtx()), []);
  assert.deepEqual(rightNow({}, {}), []);
  const out = rightNow({
    needsYou: [{ kind: 'points', title: '2 points', detail: null, go: null }],
    today: { focus: 'Plain focus', trip: null, dueSoon: [{ title: 'A' }, 'B'], torn: [] },
  }, {});
  assert.equal(out.length, 2);
  assert.equal(out[0].querySelector('.rnr').tagName, 'DIV');
  const rows = out[1].querySelectorAll('.rnr');
  assert.equal(rows.length, 3);
  rows[0].click();
});
