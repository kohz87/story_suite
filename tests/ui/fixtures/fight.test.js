import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIGHT_STATES, fightFixture } from '../../../ui/fixtures/fight.js';

const up = vm => vm.foeGroups.flatMap(g => g.members).filter(m => m.hp > 0).length;

describe('fightFixture', () => {
  it('lists the six board states and rejects an unknown one', () => {
    assert.deepEqual([...FIGHT_STATES], ['offer', 'choose', 'target', 'ally', 'after', 'end']);
    assert.throws(() => fightFixture('idle'), /unknown fight state: idle/);
    assert.equal(fightFixture().state, 'choose');
  });

  it('offer: fresh foes, no log, no order, no actor, nothing chosen', () => {
    const vm = fightFixture('offer');
    assert.equal(vm.exchange, 1);
    assert.equal(up(vm), 4);
    assert.deepEqual([vm.log, vm.order, vm.actor, vm.narratorTold, vm.end], [[], [], null, null, null]);
    assert.ok(vm.party.every(p => p.chosen === null));
  });

  it('choose: exchange 2, Brann choosing, three others chosen, exchange 1 in the log', () => {
    const vm = fightFixture('choose');
    assert.equal(vm.exchange, 2);
    assert.equal(vm.actor.id, 'brann');
    assert.equal(vm.party.find(p => p.id === 'brann').chosen, null);
    assert.equal(vm.party.find(p => p.id === 'torka').chosen, 'Brute strike → Captain');
    assert.deepEqual(vm.log.map(l => l.n), [1]);
    assert.equal(vm.log[0].rows.length, 12);
    assert.equal(vm.order[0], 'Astra');
    assert.equal(up(vm), 3);
  });

  it('actor has the four action groups, the stance and an odds word on Flee', () => {
    const { actor } = fightFixture('choose');
    assert.deepEqual(Object.keys(actor.groups), ['Attack', 'Magic', 'Item', 'Flee']);
    assert.deepEqual(actor.groups.Attack.map(a => a.target), ['member', 'member', 'group']);
    assert.equal(actor.groups.Item[0].target, 'ally');
    assert.equal(actor.groups.Flee[0].odds, 'long shot');
    assert.deepEqual(actor.stance, { name: 'Shield wall', on: true, soakOn: 22, soakOff: 17 });
  });

  it('target and ally share the choose board; after and end have no actor', () => {
    assert.deepEqual(fightFixture('target').party, fightFixture('choose').party);
    assert.equal(fightFixture('ally').actor.id, 'brann');
    assert.equal(fightFixture('after').actor, null);
    assert.equal(fightFixture('end').actor, null);
  });

  it('after: hounds down, the captain at 2, Brann’s pick resolved, two exchanges logged', () => {
    const vm = fightFixture('after');
    assert.equal(up(vm), 1);
    assert.equal(vm.foeGroups[1].members[0].hp, 2);
    assert.equal(vm.party.find(p => p.id === 'brann').chosen, 'Normal attack → Hound 3');
    assert.deepEqual(vm.log.map(l => l.rows.length), [12, 11]);
    assert.match(vm.narratorTold, /^Exchange 2:/);
  });

  it('end: won, 45 XP each, three exchanges, practice per member, nothing left standing', () => {
    const vm = fightFixture('end');
    assert.equal(up(vm), 0);
    assert.deepEqual([vm.end.outcome, vm.end.xpEach, vm.end.exchanges], ['won', 45, 3]);
    assert.deepEqual(vm.end.members.map(m => m.id), ['astra', 'torka', 'rika', 'brann']);
    assert.deepEqual(vm.end.members[0].practice, [{ skill: 'Iaijutsu', gain: 3 }, { skill: 'Shadow Step', gain: 3 }]);
    assert.equal(vm.log.length, 3);
    assert.ok(vm.party.every(p => p.chosen === null));
  });

  it('foe groups carry tier, level and the odds word (minions even, elite long shot)', () => {
    const [hounds, captain] = fightFixture('choose').foeGroups;
    assert.deepEqual([hounds.name, hounds.tier, hounds.lv, hounds.odds.word, hounds.members.length], ['Grey hounds', 'Minion', 6, 'even', 3]);
    assert.deepEqual([captain.tier, captain.lv, captain.odds.word], ['Elite', 8, 'long shot']);
  });

  it('wide worst case: 8 foes in 3 groups against the party of 4', () => {
    const vm = fightFixture('choose', { wide: true });
    assert.deepEqual(vm.foeGroups.map(g => g.members.length), [4, 3, 1]);
    assert.equal(vm.party.length, 4);
    assert.equal(vm.foeGroups[1].members[0].max, 11);
  });

  it('returns a fresh object each call (no shared mutation)', () => {
    const a = fightFixture('choose');
    a.party[0].hp = 0;
    a.actor.groups.Attack.length = 0;
    const b = fightFixture('choose');
    assert.equal(b.party[0].hp, 11);
    assert.equal(b.actor.groups.Attack.length, 3);
  });
});
