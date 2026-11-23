import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { diceBefore, lastDice } from '../src/module-parts/dice-source.js';
import { SID, astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

// Astra: every stat 12 (bonus +1), 34 hp and 34 sp. Normal is 12, hard 16.
const roll = (die, difficulty = 'normal', { labels = {}, what = 'Lore', member = astra(), live, options } = {}) => {
    const slice = sliceOf([member], live === undefined ? { list: [die, 10, 10], floor: 0 } : live);
    const ctx = fakeCtx(slice, options);
    const done = run(applyTry, ctx, line('try', member.name, `${what}; ${difficulty}`, labels));
    return { done, slice, me: slice.members[member.id], data: done.result?.data };
};

test('a total at the number is a success: no harm, practice +10 on a normal roll, the die is used', () => {
    const { data, me, slice } = roll(11);
    assert.equal(data.band, 'success');
    assert.equal(data.total, 12);
    assert.equal(me.pools.hp.now, 34);
    assert.equal(me.practice.lore, 10);
    assert.equal(slice.dice[SID].used, 1);
    assert.equal(slice.dice[SID].hardest, 1);
});

test('a hard success teaches most (+20) and a rank up is told', () => {
    const member = astra();
    member.practice.lore = 95;
    const { data, me } = roll(15, 'hard', { member });
    assert.equal(data.band, 'success');
    assert.equal(me.practice.lore, 115);
    assert.equal(data.rankUp, 'Apprentice');
});

test('an easy roll teaches nothing', () => {
    assert.equal(roll(20, 'easy').me.practice.lore ?? 0, 0);
});

test('one or two short is success at a cost: a costed skill pays twice when not in danger', () => {
    const { data, me } = roll(10, 'normal', { what: 'Obscure' });
    assert.equal(data.band, 'cost');
    assert.equal(me.pools.sp.now, 34 - 2 - 2);
    assert.equal(me.pools.hp.now, 34);
});

test('a failure in danger drops one health stage, out of danger it costs nothing', () => {
    const danger = roll(6, 'normal', { labels: { threat: 'a fair match' } });
    assert.equal(danger.data.band, 'failure');
    assert.equal(danger.me.pools.hp.now, 33);
    assert.equal(roll(6).me.pools.hp.now, 34);
    assert.equal(roll(6, 'normal', { labels: { danger: 'yes' } }).me.pools.hp.now, 33);
});

test('a bad failure (a natural 1) drops two stages even out of danger', () => {
    const { data, me } = roll(1);
    assert.equal(data.band, 'bad');
    assert.equal(me.pools.hp.now, 27);
});

test('a natural 20 is more than was asked', () => {
    assert.equal(roll(20, 'near impossible').data.band, 'great');
});

test('the recorded floor raises a difficulty the narrator named too low, and the line says so', () => {
    const { data, done } = roll(11, 'easy', { live: { list: [11, 10, 10], floor: 2 } });
    assert.equal(data.raised, true);
    assert.equal(data.difficulty, 2);
    assert.equal(data.band, 'failure');
    assert.match(done.result.summary, /raised/);
});

test('a condition raises the floor one step; fatigue does the same for a physical roll only', () => {
    const sick = astra({ conditions: [{ name: 'poisoned', until: 'treated' }] });
    assert.equal(roll(11, 'easy', { member: sick }).data.difficulty, 1);
    const tired = astra();
    tired.pools.sp.now = 5;
    assert.equal(roll(11, 'easy', { member: tired, what: 'str' }).data.difficulty, 1);
    assert.equal(roll(11, 'easy', { member: tired, what: 'int' }).data.difficulty, 0);
});

test('an injury that hampers the stat takes 2 from the bonus', () => {
    const hurt = astra({ injuries: [{ name: 'cracked rib', hampers: ['agi'], heals: 9999, grave: 'minor' }] });
    assert.equal(roll(12, 'normal', { member: hurt, what: 'Obscure' }).data.bonus, -1);
    assert.equal(roll(12, 'normal', { member: hurt, what: 'Lore' }).data.bonus, 1);
});

const boots = bonus => ({ query: name => (name === 'gear.view' ? { slots: { feet: { name: 'Wolfhide Boots', rarity: bonus.rarity, bonus: bonus.text, broken: false } } } : null) });

test('gear adds to the stat for the roll, capped by the rarity (common +1, rare +3)', () => {
    assert.equal(roll(12, 'normal', { what: 'agi', options: boots({ rarity: 'rare', text: '+2 AGI' }) }).data.bonus, 2);
    assert.equal(roll(12, 'normal', { what: 'agi', options: boots({ rarity: 'common', text: '+3 AGI' }) }).data.bonus, 1);
    assert.equal(roll(12, 'normal', { what: 'agi', options: boots({ rarity: 'rare', text: '+9 AGI' }) }).data.bonus, 2);
});

test('the tone moves the difficulty: gritty one step harder, heroic one easier', () => {
    assert.equal(roll(11, 'normal', { options: { settings: { tone: 'gritty' } } }).data.difficulty, 2);
    assert.equal(roll(11, 'normal', { options: { settings: { tone: 'heroic' } } }).data.difficulty, 0);
});

test('a companion rolls with the level term, +2 for a named strength, and takes no harm on the sheet', () => {
    const rorke = astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, level: 12, companion: { level: 12, strengths: ['swordplay'] } });
    const { data, me } = roll(6, 'normal', { member: rorke, what: 'swordplay', labels: { threat: 'above you' } });
    assert.equal(data.bonus, 3);
    assert.equal(me.pools.hp.now, 34);
    assert.equal(roll(6, 'normal', { member: rorke, what: 'riding' }).data.bonus, 1);
});

test('a refusal changes nothing: no mana for the skill, a Down character, no such skill, no dice, all dice used', () => {
    const dry = astra();
    dry.pools.sp.now = 1;
    const noSp = roll(11, 'normal', { member: dry, what: 'Obscure' });
    assert.deepEqual([noSp.done.code, noSp.slice.dice[SID].used], ['NOT_ENOUGH', undefined]);
    assert.match(noSp.done.message, /no stamina for Obscure/);
    const down = astra();
    down.pools.hp.now = 0;
    assert.equal(roll(11, 'normal', { member: down }).done.code, 'REFUSED');
    assert.equal(roll(11, 'normal', { what: 'Juggling' }).done.code, 'NOT_FOUND');
    assert.equal(roll(11, 'normal', { live: null }).done.code, 'REFUSED');
    assert.equal(roll(11, 'normal', { live: { list: [1, 2, 3], floor: 0, used: 3 } }).done.code, 'LIMITED');
});

test('dice are taken in order, one per roll', () => {
    const slice = sliceOf([astra()], { list: [11, 3, 20], floor: 0 });
    const ctx = fakeCtx(slice);
    const dice = ['Lore', 'Lore', 'Lore'].map(what => run(applyTry, ctx, line('try', 'Astra', `${what}; normal`)).result.data.die);
    assert.deepEqual(dice, [11, 3, 20]);
});

test('off means off: Text RPG not on, or the RPG on, refuses quietly with FEATURE_OFF', () => {
    assert.equal(roll(11, 'normal', { options: { on: false } }).done.code, 'FEATURE_OFF');
    assert.equal(roll(11, 'normal', { options: { rpg: true } }).done.code, 'FEATURE_OFF');
});

const step = (index, list, floor = 0) => ({ index, receipt: { type: 'textRpg.dice', data: { list, floor } } });

test('the first roll of a reply makes its record from the dice step: its own receipt on a Re-read, else the latest before it', () => {
    const fresh = () => sliceOf([astra()], null);
    const first = fakeCtx(fresh(), { receipts: [step(0, [3, 4, 5]), step(1, [11, 12, 13], 1)] });
    const done = run(applyTry, first, line('try', 'Astra', 'Lore; normal'));
    assert.deepEqual([done.result.data.die, done.result.data.difficulty], [11, 1]);
    const slice = fresh();
    const again = run(applyTry, fakeCtx(slice, { receipts: [step(0, [3, 4, 5])], standingReceipts: [{ type: 'textRpg.dice', data: { list: [15, 2, 3], floor: 0, own: true } }] }), line('try', 'Astra', 'Lore; normal'));
    assert.equal(again.result.data.die, 15, 'a Re-read uses the swipe\'s own dice step the reply holds');
    assert.deepEqual(slice.dice[SID], { list: [15, 2, 3], floor: 0, used: 1, hardest: 1 });
    assert.equal(run(applyTry, fakeCtx(fresh(), { receipts: [{ index: 0, receipt: { type: 'textRpg.dice', data: { list: [1, 2], floor: 0 } } }] }), line('try', 'Astra', 'Lore; normal')).code, 'REFUSED', 'a damaged record is no dice');
});

test('the dice step a reply reads is the one before it: a later reply\'s step on its carrier and an earlier swipe\'s own are not its dice', () => {
    const at = (index, list, own = false) => ({ index, receipt: { type: 'textRpg.dice', data: { list, floor: 0, own } } });
    // Reply 2 follows carrier 0 (its step); reply 4's step sits on carrier 2; reply 2 was swiped (own step on carrier 2, before reply 4's).
    const chat = [at(0, [1, 1, 1]), at(2, [2, 2, 2], true), at(2, [4, 4, 4])];
    assert.deepEqual(diceBefore(2, chat).list, [2, 2, 2], 'its own swipe step wins over the next reply\'s');
    assert.deepEqual(diceBefore(2, [at(0, [1, 1, 1]), at(2, [4, 4, 4])]).list, [1, 1, 1], 'a normal send: the step on the carrier before');
    assert.deepEqual(diceBefore(4, [at(0, [1, 1, 1]), at(2, [2, 2, 2], true), at(2, [4, 4, 4])]).list, [4, 4, 4], 'reply 4 reads the step on carrier 2 that is not an own step');
    assert.equal(diceBefore(2, [at(2, [4, 4, 4])]), null, 'no step before it: no dice');
    assert.deepEqual(lastDice(chat).list, [4, 4, 4], 'the next reply is offered the latest');
});

test('the difficulty word is found among extra parts: `? try Who | skill | what is tried | hard`', () => {
    const slice = sliceOf([astra()], { list: [11, 10, 10], floor: 0 });
    const done = run(applyTry, fakeCtx(slice), line('try', 'Astra', 'Lore; slip past the guards; hard'));
    assert.equal(done.result.data.difficulty, 2);
});
