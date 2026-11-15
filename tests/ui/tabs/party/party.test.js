import test from 'node:test';
import assert from 'node:assert/strict';
import { partyTab } from '../../../../ui/tabs/party/party.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { PARTY_SHAPE } from '../../../../ui/contract/party.js';
import { partyFixture } from '../../../../ui/fixtures/party.js';
import { makeCtx, flush, commands } from './helpers.js';

const names = tab => tab.querySelectorAll('.mb').map(b => b.dataset.member);

test('every party fixture size matches the Party shape', () => {
  for (const n of [1, 2, 3, 4]) assert.deepEqual(checkShape(partyFixture({ members: n }), PARTY_SHAPE), [], String(n));
});

test('the tab shows the member row, then one sheet; Astra (the player) is selected first', () => {
  const ctx = makeCtx();
  const tab = partyTab(ctx.party, ctx);
  assert.equal(tab.dataset.tab, 'party');
  assert.deepEqual(names(tab), ['astra', 'brann', 'rika', 'torka']);
  assert.deepEqual(tab.querySelectorAll('.mb').map(b => b.getAttribute('aria-current')), ['true', 'false', 'false', 'false']);
  assert.deepEqual(tab.children.map(c => c.dataset.card ?? c.className), ['members', 'psheet-slot']);
  assert.equal(tab.querySelectorAll('.psheet').length, 1);
  assert.equal(tab.querySelector('.psheet').dataset.member, 'astra');
  assert.equal(tab.querySelector('.shead'), null);
});

test('tiny health lines follow each member and the away member is marked', () => {
  const ctx = makeCtx();
  const tab = partyTab(ctx.party, ctx);
  const widths = tab.querySelectorAll('.mb .hpl b').map(b => b.style.getPropertyValue('width'));
  assert.deepEqual(widths, ['86%', '100%', '100%', '100%']);
  const rika = tab.querySelector('[data-member="rika"]');
  assert.equal(rika.classList.contains('away'), true);
  assert.equal(rika.querySelector('.aw').getAttribute('title'), 'At the Bluewatch stables with the horses');
  assert.equal(tab.querySelector('[data-member="brann"] .aw'), null);
});

test('tapping a member switches the sheet and the current mark, and the pick survives a rebuild', () => {
  const ctx = makeCtx();
  const tab = partyTab(ctx.party, ctx);
  tab.querySelector('[data-member="brann"]').click();
  assert.equal(tab.querySelector('.psheet').dataset.member, 'brann');
  assert.equal(tab.querySelector('.shead .nm').textContent, 'Brann');
  assert.deepEqual(tab.querySelectorAll('.mb').map(b => b.getAttribute('aria-current')), ['false', 'true', 'false', 'false']);
  const again = partyTab(structuredClone(ctx.party), ctx);
  assert.equal(again.querySelector('.psheet').dataset.member, 'brann');
  tab.querySelector('[data-member="astra"]').click();
  assert.equal(tab.querySelector('.shead'), null);
});

test('a pick that left the party falls back to the player', () => {
  const ctx = makeCtx();
  partyTab(ctx.party, ctx).querySelector('[data-member="torka"]').click();
  const smaller = partyFixture({ members: 2 });
  assert.equal(partyTab(smaller, ctx).querySelector('.psheet').dataset.member, 'astra');
});

test('Invite hides at the cap of 4 and sends party.invite when there is room', async () => {
  const ctx = makeCtx();
  assert.equal(partyTab(ctx.party, ctx).querySelector('.inv'), null);
  const small = partyFixture({ members: 2 });
  const tab = partyTab(small, ctx);
  assert.equal(tab.querySelector('.inv').textContent, '+ Invite');
  tab.querySelector('.inv').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['party.invite', {}]]);
  assert.equal(partyTab({ ...partyFixture(), canInvite: true }, ctx).querySelector('.inv'), null);
});

test('an empty party renders an empty tab, or only Invite when allowed; missing data is tolerated', () => {
  const ctx = makeCtx();
  const empty = partyTab({ pcId: 'astra', max: 4, canInvite: false, members: [] }, ctx);
  assert.equal(empty.children.length, 0);
  const inviteOnly = partyTab({ pcId: 'astra', max: 4, canInvite: true, members: [] }, ctx);
  assert.equal(inviteOnly.querySelectorAll('.inv').length, 1);
  assert.equal(inviteOnly.querySelector('.psheet'), null);
  assert.equal(partyTab(undefined).children.length, 0);
  assert.equal(partyTab(partyFixture({ members: 1 }), {}).querySelectorAll('.mb').length, 1);
});

test('a member with no health bar shows an empty line instead of failing', () => {
  const ctx = makeCtx();
  const party = partyFixture({ members: 2 });
  party.members[1].bars = [];
  assert.equal(partyTab(party, ctx).querySelectorAll('.mb .hpl b')[1].style.getPropertyValue('width'), '0%');
});
