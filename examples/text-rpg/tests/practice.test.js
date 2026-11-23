import test from 'node:test';
import assert from 'node:assert/strict';
import { applySpend } from '../src/module-parts/kinds/pools.js';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { practiceFor, rollPractice } from '../src/rules/practice.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

// Astra: Novice in her skills (bonus 0), Obscure costs 2 sp, Lore is free. Ordinary is 15 (die 15 = success), hard 20.
const SIDS = ['sw_reply0001', 'sw_reply0002'];
const spend = (slice, skill = 'Obscure', { sid = SIDS[0], member = 'Astra' } = {}) => {
    const done = run(applySpend, fakeCtx(slice, { sid }), line('spend', member, skill));
    assert.equal(done.ok, true, done.message);
    return done.result.data;
};
const attempt = (slice, what, word, { sid = SIDS[0], labels = {} } = {}) => {
    const done = run(applyTry, fakeCtx(slice, { sid }), line('try', 'Astra', `${what}; ${word}`, labels));
    assert.equal(done.ok, true, done.message);
    return done.result.data;
};
const make = (threat) => {
    const slice = sliceOf([astra()], { list: [15, 15, 15], floor: 0 });
    for (const sid of SIDS.slice(1)) slice.dice[sid] = { list: [15, 15, 15], floor: 0 };
    if (threat !== undefined) slice.dice[SIDS[0]].threat = threat;
    return slice;
};
const lore = slice => slice.members.ac_astra001.practice.lore ?? 0;
const obscure = slice => slice.members.ac_astra001.practice.obscure ?? 0;

test('the scale: far beneath nothing, beneath half, a fair match whole, above one and a half, far above and beyond double; rounded, at least 1; none known counts whole', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => practiceFor(10, threat)), [0, 5, 10, 15, 20, 20]);
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => practiceFor(5, threat)), [0, 3, 5, 8, 10, 10]);
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => practiceFor(3, threat)), [0, 2, 3, 5, 6, 6], 'a failed roll\'s 3: beneath 1.5 rounds to 2');
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => practiceFor(1, threat)), [0, 1, 1, 2, 2, 2], 'a use without a roll\'s 1: beneath (half) rounds up to 1, above (1.5) to 2');
    assert.equal(practiceFor(1, 1), 1, 'at least 1 when more than 0 is earned');
    assert.equal(practiceFor(10, null), 10);
    assert.equal(practiceFor(0, 4), 0);
    assert.equal(rollPractice('success', 3, 3), 15);
    assert.equal(rollPractice('failure', 2, 3), 5, 'a failed roll: 3 ×1.5 = 4.5');
    assert.equal(rollPractice('success', 0, 3), 0, 'a trivial roll teaches nothing at any threat');
});

test('a costed skill used with `~ spend` teaches +1, and says so in the receipt', () => {
    const slice = make();
    assert.deepEqual([spend(slice).practice, obscure(slice)], [1, 1]);
});

test('`~ spend` is scaled by the threat so far: beneath 1 (0.5 rounded up), a fair match 1, above 2 (1.5), far above 2, far beneath none', () => {
    const got = [1, 2, 3, 4, 0].map(threat => spend(make(threat)).practice);
    assert.deepEqual(got, [1, 1, 2, 2, 0]);
});

test('`~ spend` takes the threat of the latest earlier reply when the reply named none', () => {
    const slice = make();
    slice.dice[SIDS[0]].threat = 3;
    assert.equal(spend(slice, 'Obscure', { sid: SIDS[1] }).practice, 2);
});

test('the same skill gains from `~ spend` once a reply: a second line adds nothing, another skill or another reply gains', () => {
    const slice = make();
    assert.equal(spend(slice).practice, 1);
    assert.equal(spend(slice).practice, 0, 'the second use in the reply');
    assert.equal(obscure(slice), 1);
    assert.equal(spend(slice, 'Obscure', { sid: SIDS[1] }).practice, 1, 'the next reply');
    assert.equal(obscure(slice), 2);
});

test('a roll for the skill in the same reply wins over `~ spend`, in either order: the reply teaches the roll\'s points only', () => {
    const after = make();
    assert.equal(spend(after).practice, 1);
    const rolled = attempt(after, 'Obscure', 'ordinary');
    assert.equal(rolled.practice, 5);
    assert.equal(obscure(after), 5, 'the spend before the roll gave its 1 back');
    assert.equal(spend(after).practice, 0, 'and a spend after the roll adds nothing');
    const before = make();
    assert.equal(attempt(before, 'Obscure', 'ordinary').practice, 5);
    assert.equal(spend(before).practice, 0);
    assert.equal(obscure(before), 5);
});

test('a roll teaches by the threat it was made under: +5 a success, +10 at hard or harder, scaled; nothing far beneath', () => {
    const fair = attempt(make(), 'Lore', 'ordinary', { labels: { threat: 'a fair match' } });
    assert.equal(fair.practice, 5);
    const above = make();
    above.dice[SIDS[0]].list = [20, 15, 15];
    assert.equal(attempt(above, 'Lore', 'hard', { labels: { threat: 'above you' } }).practice, 15, 'a hard success (20 against 20): 10 ×1.5');
    assert.equal(lore(above), 15);
    const beneath = make();
    assert.equal(attempt(beneath, 'Lore', 'ordinary', { labels: { threat: 'beneath you' } }).practice, 3, '5 ×0.5 = 2.5 rounds to 3');
    const none = make();
    assert.equal(attempt(none, 'Lore', 'ordinary', { labels: { threat: 'far beneath you' } }).practice, 0);
    assert.equal(lore(none), 0, 'a far beneath roll teaches nothing');
    assert.equal(attempt(make(), 'Lore', 'ordinary').practice, 5, 'no threat said: counts whole');
});

test('a rank up from `~ spend` is told', () => {
    const slice = make();
    slice.members.ac_astra001.practice.obscure = 39;
    assert.equal(spend(slice).rankUp, 'Apprentice');
});

test('a spend near the cap marks only what it really added, so the roll takes back only that', () => {
    const slice = make();
    slice.members.ac_astra001.practice.obscure = 600;
    assert.equal(spend(slice).practice, 1, 'the receipt says the points of the line');
    assert.equal(obscure(slice), 600, 'capped');
    assert.equal(slice.spent[SIDS[0]].obscure, 0, 'the mark holds the 0 that were added');
    attempt(slice, 'Obscure', 'ordinary');
    assert.equal(obscure(slice), 600, 'nothing was added, so nothing is taken back');
});
