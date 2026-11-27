// What fallen foes pay (kind × threat multiplier), a battle's cap across waves, and what pays nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFoes } from '../src/module-parts/kinds/foes.js';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { applyLesson } from '../src/module-parts/kinds/lesson.js';
import { foeXp, battleCap } from '../src/rules/foe-ladder.js';
import { validate } from '../src/domain/validate.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

const reply = n => `sw_reply${String(n).padStart(4, '0')}`;
const rolled = (extra = {}) => ({ list: [10, 10, 10], floor: 0, used: 1, hardest: 2, won: true, ...extra });
// A slice whose replies 1..5 each have a dice record (`clock` minutes when clocks is given).
const world = ({ level = 1, clocks = null, member = astra({ xp: (level - 1) * 100 }) } = {}) => {
    const slice = sliceOf([member], null);
    for (let n = 1; n <= 5; n++) slice.dice[reply(n)] = rolled(clocks ? { clock: clocks[n - 1] } : {});
    return slice;
};
const foes = (slice, n, name, kind, count) => run(applyFoes, fakeCtx(slice, { sid: reply(n) }), { ...line('foes', name, '', { count: String(count), kind }), op: '+' });
const fell = (slice, n, count, labels = {}) => run(applyXp, fakeCtx(slice, { sid: reply(n) }), line('xp', 'Party', 'they fall', { foes: String(count), ...labels }));
const xpOf = slice => slice.members.ac_astra001.xp;

test('each fallen foe pays its kind × the threat multiplier', () => {
    assert.deepEqual(['vermin', 'common', 'trained', 'elite', 'monster', 'legend'].map(kind => foeXp(kind, 2, 1)), [5, 10, 20, 40, 80, 160]);
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => foeXp('common', threat, 4)), [0, 20, 40, 80, 120, 160]);
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(battleCap), [0, 25, 50, 75, 100, 200]);
    const got = ['vermin', 'common', 'trained', 'elite', 'monster', 'legend'].map(kind => { const slice = world({ level: 1 }); foes(slice, 1, 'G', kind, 1); fell(slice, 2, 1); return xpOf(slice); });
    // level 1 threats are 1, 2, 3, 4, 5, 5 → ×0.5, 1, 2, 3, 4, 4, within each battle's cap
    assert.deepEqual(got, [3, 10, 40, 100, 200, 200].map((pay, at) => Math.min(pay, [25, 50, 75, 100, 200, 200][at])));
});

test('24 rats at a fair-for-nobody level pay a little, not a level: vermin at level 1 is beneath, the battle caps at 25', () => {
    const slice = world();
    foes(slice, 1, 'Rats', 'vermin', 24);
    const done = fell(slice, 2, 24);
    assert.equal(xpOf(slice), 25, '24 × 2.5 = 60, cut to the cap');
    assert.match(done.result.summary, /^25 xp for they fall \(24 foes\); battle cap reached: 25 of 25\./);
    assert.deepEqual(done.result.data.battle, { paid: 25, cap: 25 });
    assert.deepEqual(validate(slice), []);
});

test('the battle cap holds across waves and is set by the strongest group; a battle under it shows "x of cap"', () => {
    const slice = world();
    foes(slice, 1, 'Wolves', 'common', 6);
    const first = fell(slice, 2, 3);
    assert.equal(xpOf(slice), 30);
    assert.match(first.result.summary, /battle 30 of 50\./);
    assert.doesNotMatch(first.result.summary, /cap reached/);
    foes(slice, 3, 'Guards', 'trained', 2);
    assert.equal(Object.values(slice.foes.groups).every(group => group.fight === reply(1)), true, 'a wave while foes stand joins the battle');
    fell(slice, 4, 3, { group: 'Wolves' });
    assert.equal(xpOf(slice), 60, 'the strongest group is trained (threat 3): the cap is 75; 30 + 30');
});

test('paying stops at the cap: only what is left under it is paid, and the receipt says so', () => {
    const slice = world();
    foes(slice, 1, 'Wolves', 'common', 6);
    fell(slice, 2, 4, { group: 'Wolves' });
    const rest = fell(slice, 3, 2, { group: 'Wolves' });
    assert.equal(xpOf(slice), 50, '4 × 10 = 40, then 2 × 10 cut to the 10 left');
    assert.match(rest.result.summary, /battle cap reached: 50 of 50/);
    assert.equal(slice.foes.fights[reply(1)].paid, 50);
});

test('a wave within 60 story minutes of the fight closing joins the same battle; after that it is a new one', () => {
    const slice = world({ clocks: [0, 10, 40, 100, 200] });
    foes(slice, 1, 'Wolves', 'common', 5);
    fell(slice, 2, 5);
    assert.equal(xpOf(slice), 50);
    foes(slice, 3, 'Wolves', 'common', 2);
    assert.equal(slice.foes.groups['wolves-2'] ? slice.foes.groups['wolves-2'].fight : slice.foes.groups.wolves.fight, reply(1), '30 minutes after: the same battle');
    fell(slice, 3, 2);
    assert.equal(xpOf(slice), 50, 'the shared cap is already reached');
    foes(slice, 5, 'Bandits', 'common', 2);
    const fresh = Object.values(slice.foes.groups).filter(group => group.fight === reply(5));
    assert.equal(fresh.length, 1, '160 minutes after: a new battle');
    fell(slice, 5, 2);
    assert.equal(xpOf(slice), 70, 'a new battle has its own cap');
});

test('with no clock a wave in the reply right after the fight closed joins it; one a reply later does not', () => {
    const slice = world();
    foes(slice, 1, 'Wolves', 'common', 2);
    fell(slice, 2, 2);
    foes(slice, 3, 'Bandits', 'common', 2);
    assert.equal(slice.foes.groups.bandits.fight, reply(1));
    fell(slice, 3, 2);
    foes(slice, 5, 'Thugs', 'common', 2);
    assert.equal(slice.foes.groups.thugs.fight, reply(5), 'reply 5 comes two replies after reply 3 touched the last group');
});

test('foes that fled or were ended pay nothing; a reply with no roll pays nothing but counts the foes down', () => {
    const slice = world();
    foes(slice, 1, 'Wolves', 'common', 4);
    assert.equal(run(applyFoes, fakeCtx(slice, { sid: reply(2) }), { ...line('foes', 'Wolves'), op: '-' }).ok, true);
    assert.equal(slice.foes.groups.wolves.left, 0);
    assert.equal(xpOf(slice), 0);
    foes(slice, 3, 'Bandits', 'common', 3);
    slice.dice[reply(4)] = { list: [10, 10, 10], floor: 0 };
    const none = fell(slice, 4, 2);
    assert.deepEqual([xpOf(slice), slice.foes.groups.bandits.left, none.result.summary], [0, 1, 'no roll this reply: no XP for they fall (2 foes).']);
    assert.equal(slice.foes.fights[reply(1)].paid, undefined, 'the wave joined the battle the ended group closed, and nothing went under the cap');
});

test('with no foes record: 10 XP when a roll succeeded this reply, else none; once a reply', () => {
    const slice = world();
    assert.equal(fell(slice, 1, 1).result.data.amount, 10);
    assert.equal(run(applyXp, fakeCtx(slice, { sid: reply(1) }), line('xp', 'Party', 'again')).ok, true, 'a fresh ctx claims its own');
    const lost = world();
    lost.dice[reply(1)] = rolled({ won: undefined });
    assert.equal(fell(lost, 1, 1).result.data.amount, 0, 'rolled but no success');
    const bare = world();
    bare.dice[reply(1)] = { list: [10, 10, 10], floor: 0 };
    assert.equal(fell(bare, 1, 1).result.summary, 'no roll this reply: no XP for they fall.');
    const once = fakeCtx(world(), { sid: reply(1) });
    assert.equal(run(applyXp, once, line('xp', 'Party', 'a')).ok, true);
    assert.equal(run(applyXp, once, line('xp', 'Party', 'b')).code, 'LIMITED');
});

test('old lines are refused or ignored: + foes with threat: and no kind makes no group, size: on + xp pays nothing, and a chat\'s old fight pays the no-record amount', () => {
    const slice = world();
    const old = run(applyFoes, fakeCtx(slice, { sid: reply(1) }), { ...line('foes', 'Rats', '', { count: '24', threat: 'a fair match' }), op: '+' });
    assert.equal(old.code, 'INVALID');
    assert.equal(old.message, '+ foes needs a kind: vermin, common, trained, elite, monster or legend');
    assert.equal(slice.foes, undefined, 'no group, so nothing stands');
    assert.equal(fell(slice, 2, 24, { size: 'minor' }).result.data.amount, 10, 'its kills pay the no-record 10 XP, whatever the size: says');
    assert.equal(xpOf(slice), 10);
    const bare = world();
    assert.equal(fell(bare, 1, 1, { size: 'real', threat: 'above you' }).result.data.amount, 10, 'size: and threat: do not pay');
    assert.equal(fell(world(), 1, 1, { size: 'huge' }).ok, true, 'a size that is no size is ignored, not refused');
    const lost = world({ member: astra() });
    lost.dice[reply(1)].won = false;
    assert.equal(fell(lost, 1, 1, { size: 'great' }).result.data.amount, 0, 'no win, no XP');
    const kinded = world();
    foes(kinded, 1, 'Rats', 'vermin', 24);
    assert.equal(fell(kinded, 2, 24, { size: 'great' }).result.data.amount, 25, 'a group of a kind pays by the record and its cap (24 × 2.5 = 60, capped at 25), not by size:');
});

test('a lesson is taught once a skill a battle, across the waves that joined it', () => {
    const slice = world();
    foes(slice, 1, 'Wolves', 'common', 1);
    slice.foes.fights[reply(1)].rolled.ac_astra001 = ['lore'];
    fell(slice, 2, 1);
    const teach = n => run(applyLesson, fakeCtx(slice, { sid: reply(n) }), line('lesson', 'Astra', 'Lore; learned'));
    foes(slice, 3, 'Bandits', 'common', 1);
    assert.equal(teach(3).code, 'REFUSED', 'the second wave stands: the battle is not over');
    fell(slice, 3, 1);
    assert.equal(teach(3).ok, true);
    foes(slice, 4, 'Thugs', 'common', 1);
    fell(slice, 4, 1);
    assert.equal(teach(4).code, 'LIMITED', 'one lesson a skill a battle, waves or not');
});
