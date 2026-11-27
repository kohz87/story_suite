// A sheet row from a plug-in: no soak chip without a soak figure, and the XP bar's words come from the row when it gives them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { memberSheet } from '../../../../ui/tabs/party/sheet.js';
import { selectParty } from '../../../../ui/select/party.js';
import { makeCtx } from './helpers.js';

const ctxWith = patch => { const ctx = makeCtx(); Object.assign(ctx.party.members.find(m => m.id === 'brann'), patch); return ctx; };
const brann = ctx => ctx.party.members.find(m => m.id === 'brann');

test('a null soakPct draws no chip, a number still does', () => {
  const none = ctxWith({ soakPct: null });
  const el = memberSheet(brann(none), none);
  assert.equal(el.querySelector('.chip2'), null);
  assert.ok(!el.textContent.includes('null%'));
  const some = ctxWith({ soakPct: 17 });
  assert.equal(memberSheet(brann(some), some).querySelector('.chip2').textContent, '17%');
});

test('the XP words are the row\'s xpLabel, else the percent over 100; the bar stays the percent', () => {
  const own = ctxWith({ xpPct: 40, xpLabel: '20/50' });
  const el = memberSheet(brann(own), own);
  assert.equal(el.querySelector('.xp2').textContent, 'XP20/50');
  assert.equal(el.querySelector('.xp2 b').style.getPropertyValue('width'), '40%');
  const plain = ctxWith({ xpPct: 40, xpLabel: null });
  assert.equal(memberSheet(brann(plain), plain).querySelector('.xp2').textContent, 'XP40/100');
});

test('the party view-model carries a row\'s xpLabel and soakPct null', () => {
  const [me] = selectParty({ actors: [{ id: 'a', name: 'A' }], levels: { a: 1 }, sheet: [{ id: 'a', name: 'A', xpPct: 0, xpLabel: '0/50', soakPct: null }] }).members;
  assert.equal(me.xpLabel, '0/50');
  assert.equal(me.soakPct, null);
});

test('a companion with a load of their own has a "Carrying" chip; without one, none', () => {
  const none = ctxWith({ soakPct: null });
  assert.equal(memberSheet(brann(none), none).querySelector('[data-carrying]'), null);
  const some = ctxWith({ carrying: { load: 18, capacity: 42 } });
  assert.equal(memberSheet(brann(some), some).querySelector('[data-carrying]').textContent, 'Carrying 18 / 42');
});
