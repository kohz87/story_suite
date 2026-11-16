import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectFight } from '../../../ui/select/fight.js';
import { FIGHT_SHAPE } from '../../../ui/contract/fight.js';
import { checkShape } from '../../../ui/contract/shapes.js';

// Answers as the board code gives them:
// snapshot { session, played: { state, result } }: board/view.js:72 (`snapshot`), played = engine.js:155 `playBoard`; session.js:34 for setup/exchanges.
// result.members: members.js:178 `boardFoes` ({ slot, group, n, name, value, size, pack, count, left, attacks, standing }).
const MEMBERS = [
  { slot: 11, group: 1, n: 1, name: 'Hound 1', value: 0, size: 5, pack: false, count: 1, left: 0, attacks: 0, standing: false },
  { slot: 12, group: 1, n: 2, name: 'Hound 2', value: 5, size: 5, pack: false, count: 1, left: 1, attacks: 1, standing: true },
  { slot: 2, group: 2, n: 1, name: 'Captain', value: 10, size: 11, pack: false, count: 1, left: 1, attacks: 1, standing: true },
];
// A round line: standard roll lines as note.js:105 `labelLine` reads them ({ kind, pc, foe, skill, outcome, decisive }).
const HIT = { kind: 'pc', pc: { who: 'Astra', die: 19, total: 28, statBonus: 7, rank: 2 }, foe: { name: 'Hound 1', total: 16 }, skill: 'Iaijutsu', outcome: 'hit', decisive: true };
const FOE_HIT = { kind: 'foe', pc: { who: 'Torka', die: 8, total: 15, statBonus: 7 }, foe: { name: 'Captain', die: 12, total: 21 }, outcome: 'fail' };
const GLANCE = { kind: 'foe', soaked: 0, pc: { who: 'Brann', die: 5, total: 9 }, foe: { name: 'Captain', die: 4, total: 8 }, outcome: 'fail' };
// order entries: standard/roll.js:53 ([{ id, name, total, agi, party }]).
const ORDER = [{ id: 'astra', name: 'Astra', party: true }, { id: 'f:11', name: 'Hound 1', party: false }, { id: 'f:12', name: 'Hound 2', party: false }, { id: 'f:2', name: 'Captain', party: false }];
const RESULT = (extra = {}) => ({ rounds: [{ n: 1, decisive: true, lines: [HIT, FOE_HIT, GLANCE] }], opening: [], order: ORDER, members: MEMBERS, stop: 'open', ...extra });
const snapshot = (result = RESULT(), exchanges = [{ actions: [] }]) => ({ session: { id: 's1:0', setup: { offset: 0 }, exchanges }, played: { result }, heldSid: null });
// readParty records: view/party-data.js:169 (name, level, bars.{health,mana,stamina}.{value,max}).
const bars = (h, m, s) => ({ health: { value: h, max: 14 }, mana: { value: m, max: 14 }, stamina: { value: s, max: 15 } });
const PARTY = [{ name: 'Astra', level: 6, bars: bars(11, 14, 9) }, { name: 'Torka', level: 6, bars: bars(7, 13, 15) }];
// readFoes real foes: party-data.js:205 / read.js:167 ({ slot, name, count, level, hurt, size }).
const FOES = [{ slot: 1, name: 'Grey hound', count: 2, level: 6, hurt: 5, size: 5 }, { slot: 2, name: 'Bandit captain', count: 1, level: 8, hurt: 10, size: 11 }];
// boardChoices answer: board/view-data.js:17 (choices: { label, reason, view, action }).
const CHOICES = {
  actor: { who: 'Astra' },
  choices: [
    { label: 'Attack with Katana (STR)', view: { name: 'Attack with Katana', stat: 'STR' }, action: { who: 'Astra', kind: 'attack' } },
    { label: 'Iaijutsu', view: { name: 'Iaijutsu → one', stat: 'dex', uses: 'stamina', cost: 1 }, action: { who: 'Astra', kind: 'skill', skill: 'Iaijutsu' } },
    { label: 'Flash', view: { name: 'Flash', stat: 'int', uses: 'mana', cost: 2, area: true }, reason: 'Not enough Mana', action: { who: 'Astra', kind: 'skill', skill: 'Flash', area: true } },
    { label: 'Mend', view: { name: 'Mend → Torka', stat: 'wis', uses: 'mana', cost: 1 }, action: { who: 'Astra', kind: 'skill', skill: 'Mend', target: 'Torka', support: true } },
    { label: 'Use item', view: { name: 'Use item' }, items: [{ stack: 'x' }], action: { who: 'Astra', kind: 'item' } },
    { label: 'Flee', view: { name: 'Flee' }, action: { who: 'Astra', kind: 'flee' } },
  ],
};
const input = (extra = {}) => ({ snapshot: snapshot(), party: PARTY, foes: FOES, choices: CHOICES, view: { chosen: [] }, ...extra });

describe('selectFight', () => {
  it('returns null with no snapshot, no result or a board error', () => {
    assert.equal(selectFight(), null);
    assert.equal(selectFight({ snapshot: null }), null);
    assert.equal(selectFight({ snapshot: { session: {}, played: { error: 'The fight setup is damaged.' } } }), null);
  });

  it('groups board members under the real foe and keeps gaps null', () => {
    const vm = selectFight(input());
    assert.deepEqual(vm.foeGroups.map(g => [g.name, g.lv, g.tier, g.odds.word, g.members.length]), [['Grey hound', 6, null, null, 2], ['Bandit captain', 8, null, null, 1]]);
    assert.deepEqual(vm.foeGroups[0].members[0], { id: '11', arg: { target: 11 }, name: 'Hound 1', hp: 0, max: 5 });
    assert.equal(vm.bonuses, null);
    assert.equal(vm.narratorTold, null);
    assert.equal(vm.subtitle, null);
    assert.equal(vm.title, 'Fight');
    assert.equal(selectFight(input({ place: 'Auvoth bridge' })).title, 'Fight · Auvoth bridge');
  });

  it('numbers the exchange from the offset plus the staged ones', () => {
    assert.equal(selectFight(input()).exchange, 2);
    const later = snapshot(RESULT(), [{ actions: [] }, { actions: [] }]);
    later.session.setup.offset = 3;
    assert.equal(selectFight(input({ snapshot: later })).exchange, 6);
  });

  it('picks the state: choose, target, ally, after, end', () => {
    assert.equal(selectFight(input()).state, 'choose');
    assert.equal(selectFight(input({ view: { targeting: 'foe' } })).state, 'target');
    assert.equal(selectFight(input({ view: { targeting: 'ally' } })).state, 'ally');
    assert.equal(selectFight(input({ choices: { actor: null, choices: [] } })).state, 'after');
    assert.equal(selectFight(input({ snapshot: snapshot(RESULT({ stop: 'won' })) })).state, 'end');
  });

  it('builds the party strip from the bars and the staged picks', () => {
    const vm = selectFight(input({ view: { chosen: [{ who: 'Torka', kind: 'skill', skill: 'Brute strike', target: 'Captain' }, { who: 'Astra', kind: 'flee' }] } }));
    assert.deepEqual(vm.party[0], { id: 'astra', arg: { target: 'Astra' }, actorId: 'astra', name: 'Astra', portrait: null, hp: 11, hpMax: 14, mp: 14, mpMax: 14, sp: 9, spMax: 15, chosen: 'Flee' });
    assert.equal(vm.party[1].chosen, 'Brute strike → Captain');
    assert.equal(selectFight(input()).party[0].chosen, null);
  });

  it('sorts the choosing member’s choices into the four groups, with targets and enabled', () => {
    const { actor } = selectFight(input());
    assert.equal(actor.id, 'astra');
    assert.equal(actor.stance, null);
    const by = Object.fromEntries(Object.entries(actor.groups).map(([k, list]) => [k, list.map(a => [a.label, a.cost, a.target, a.enabled])]));
    assert.deepEqual(by.Attack, [['Attack with Katana', 'STR damage · free', 'member', true], ['Iaijutsu → one', 'DEX · 1 Stamina', 'member', true]]);
    assert.deepEqual(by.Magic, [['Flash', 'INT · 2 Mana', 'group', false], ['Mend → Torka', 'WIS · 1 Mana', 'ally', true]]);
    assert.deepEqual(by.Item, [['Use item', '1 kinds in the bag', 'ally', true]]);
    assert.deepEqual(by.Flee, [['Flee', 'Escape', 'none', true]]);
    assert.equal(actor.groups.Magic[0].pick.args.area, true); // an area skill: area on the pick; a group is asked for with two groups
    assert.equal(actor.groups.Attack[0].pick.args.area, undefined);
    assert.equal(actor.groups.Flee[0].pick.alone, true);
    assert.equal(actor.groups.Attack[0].damage, null);
    assert.equal(actor.groups.Attack[0].odds, null);
  });

  it('has no actor when nobody is choosing or the fight ended', () => {
    assert.equal(selectFight(input({ choices: { actor: null, choices: [] } })).actor, null);
    assert.equal(selectFight(input({ snapshot: snapshot(RESULT({ stop: 'lost' })) })).actor, null);
  });

  it('lists the order with a split group once, under its plural name', () => {
    assert.deepEqual(selectFight(input()).order, ['Astra', 'Hounds', 'Captain']);
  });

  it('turns round lines into log rows', () => {
    const [round] = selectFight(input()).log;
    assert.equal(round.n, 1);
    assert.equal(round.summary, '3 rolls · decisive');
    assert.deepEqual(round.rows[0], { who: 'Astra → Hound 1', what: 'Iaijutsu', outcome: 'HIT · DECISIVE', math: 'd20 19 +9 = 28 vs 16' });
    assert.deepEqual(round.rows[1], { who: 'Captain → Torka', what: 'Attacks', outcome: 'FAIL', math: 'Captain d20 12 +9 = 21 vs Torka’s defence d20 8 +7 = 15' });
    assert.equal(round.rows[2].outcome, 'GLANCED OFF');
  });

  it('turns item, flee and heal lines into rows', () => {
    const lines = [{ item: 'Healing draught', pc: { who: 'Rika' }, target: 'Brann' }, { flee: true, pc: { who: 'Astra' }, outcome: 'fail' }, { support: true, skill: 'Mend', target: 'Torka', pc: { who: 'Astra' }, outcome: 'hit' }];
    const rows = selectFight(input({ snapshot: snapshot(RESULT({ rounds: [{ n: 1, lines }] })) })).log[0].rows;
    assert.deepEqual(rows.map(r => [r.who, r.what, r.outcome, r.math]), [['Rika', 'Uses Healing draught', 'ITEM', 'on Brann'], ['Astra', 'Flees', 'FAIL', ''], ['Astra', 'Mend → Torka', 'HIT', '']]);
  });

  it('fills end from the result and the pending awards, with xp null when unknown', () => {
    const won = snapshot(RESULT({ stop: 'won' }));
    const vm = selectFight(input({ snapshot: won, awards: { xp: [{ who: 'Astra', amount: 45 }], practice: [{ who: 'Astra', skill: 'Iaijutsu', amount: 3 }] } }));
    assert.deepEqual(vm.end, { outcome: 'won', xpEach: 45, exchanges: 1, members: [
      { id: 'astra', hp: 11, hpMax: 14, practice: [{ skill: 'Iaijutsu', gain: 3 }] }, { id: 'torka', hp: 7, hpMax: 14, practice: [] }] });
    assert.equal(selectFight(input({ snapshot: won })).end.xpEach, null);
    assert.equal(selectFight(input()).end, null);
    assert.equal(vm.exchange, 1);
  });

  it('matches the contract; tier, the odds word and xpEach are null gaps the shape allows', () => {
    const vm = selectFight(input());
    const errors = checkShape(vm, FIGHT_SHAPE).filter(e => !/stance|bonuses/u.test(e));
    assert.deepEqual(errors, []);
    assert.deepEqual([vm.foeGroups[0].tier, vm.foeGroups[0].odds.word, vm.foeGroups[0].id], [null, null, '1']);
    assert.deepEqual(vm.actors.map(a => a.id), ['astra']);
    assert.deepEqual(vm.actors[0].groups.Attack[0].pick, { choice: 'attack', args: { who: 'Astra' } });
    assert.deepEqual(vm.actors[0].groups.Magic[0].pick.args, { who: 'Astra', skill: 'Flash', area: true });
  });
});
