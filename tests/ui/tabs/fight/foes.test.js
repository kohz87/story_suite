import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { foesCard } from '../../../../ui/tabs/fight/foes.js';
import { fightFixture } from './helpers.js';

test('foes: groups show level, tier and member health; the count line says how many are down', () => {
  installFakeDom();
  const card = foesCard(fightFixture('choose').foeGroups);
  assert.equal(card.querySelector('.cnt').textContent, '4 · 1 down');
  const groups = card.querySelectorAll('.fg');
  assert.equal(groups.length, 2);
  assert.match(groups[0].querySelector('.h').textContent, /Grey hounds ×3Lv 6Minion/);
  assert.match(groups[1].querySelector('.h').textContent, /^Bandit captainLv 8Elite$/);
  assert.equal(card.querySelectorAll('.mbx.down').length, 1);
  assert.equal(card.querySelectorAll('.mbx.tgt').length, 0);
});

test('foes: the fold view has one line per group, and is left out while picking a target', () => {
  installFakeDom();
  const vm = fightFixture('choose');
  const lines = foesCard(vm.foeGroups).querySelectorAll('.fline');
  assert.equal(lines.length, 2);
  assert.match(lines[0].textContent, /Grey hounds.*Minion.*2 of 3 up/);
  assert.equal(foesCard(vm.foeGroups, { pick: 'member' }).querySelector('.fold-view'), null);
});

test('foes: picking a member lights each standing foe with its odds word; a downed foe stays off', () => {
  installFakeDom();
  const picked = [];
  const card = foesCard(fightFixture('target').foeGroups, { pick: 'member', onPick: t => picked.push(t) });
  const lit = card.querySelectorAll('.mbx.tgt');
  assert.equal(lit.length, 3);
  assert.equal(lit[0].querySelector('.todds').textContent, 'even');
  assert.equal(card.querySelector('.mbx.down').hasAttribute('disabled'), true);
  lit[2].click();
  assert.deepEqual(picked, [{ kind: 'member', id: 'Captain' }]);
  assert.equal(card.querySelector('.mbx.tgt .todds.longshot') !== null, true);
});

test('foes: picking a group lights standing groups only; tap and Enter both pick', () => {
  installFakeDom();
  const vm = fightFixture('choose');
  vm.foeGroups[1].members[0].hp = 0;
  const picked = [];
  const card = foesCard(vm.foeGroups, { pick: 'group', onPick: t => picked.push(t) });
  const lit = card.querySelectorAll('.fg.tgt');
  assert.equal(lit.length, 1);
  assert.equal(lit[0].querySelector('.todds').textContent, 'even each');
  lit[0].click();
  lit[0].dispatch('keydown', { key: 'Enter' });
  lit[0].dispatch('keydown', { key: 'a' });
  assert.deepEqual(picked, [{ kind: 'group', id: 'Grey hounds' }, { kind: 'group', id: 'Grey hounds' }]);
});

test('foes: the 8-foe worst case lists three groups; empty or missing groups give null', () => {
  installFakeDom();
  const wide = fightFixture('choose', { wide: true }).foeGroups;
  assert.equal(wide.flatMap(g => g.members).length, 8);
  assert.equal(foesCard(wide).querySelectorAll('.fg').length, 3);
  assert.equal(foesCard([]), null);
  assert.equal(foesCard(undefined), null);
});

test('foes: all down reads "all down"', () => {
  installFakeDom();
  const card = foesCard(fightFixture('end').foeGroups);
  assert.equal(card.querySelector('.cnt').textContent, '4 · all down');
});
