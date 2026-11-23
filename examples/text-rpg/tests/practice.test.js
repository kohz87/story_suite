import test from 'node:test';
import assert from 'node:assert/strict';
import { applySpend } from '../src/module-parts/kinds/pools.js';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { practiceFor, rollPractice } from '../src/rules/practice.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

// Astra: every stat 12 (bonus +1), Obscure costs 2 sp, Lore is free. Normal is 12 (die 11 = success), hard 16.
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
    const slice = sliceOf([astra()], { list: [11, 11, 11], floor: 0 });
    for (const sid of SIDS.slice(1)) slice.dice[sid] = { list: [11, 11, 11], floor: 0 };
    if (threat !== undefined) slice.dice[SIDS[0]].threat = threat;
    return slice;
};
const lore = slice => slice.members.ac_astra001.practice.lore ?? 0;
const obscure = slice => slice.members.ac_astra001.practice.obscure ?? 0;

test('the scale: far beneath nothing, beneath half, a fair match whole, above one and a half, far above and beyond double; rounded, at least 1; none known counts whole', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => practiceFor(10, threat)), [0, 5, 10, 15, 20, 20]);
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => practiceFor(5, threat)), [0, 3, 5, 8, 10, 10]);
    assert.equal(practiceFor(1, 1), 1, 'at least 1 when more than 0 is earned');
    assert.equal(practiceFor(10, null), 10);
    assert.equal(practiceFor(0, 4), 0);
    assert.equal(rollPractice('success', 2, 3), 30);
    assert.equal(rollPractice('success', 0, 3), 0, 'an easy roll teaches nothing at any threat');
});

test('a costed skill used with `~ spend` teaches +5, and says so in the receipt', () => {
    const slice = make();
    assert.deepEqual([spend(slice).practice, obscure(slice)], [5, 5]);
});

test('`~ spend` is scaled by the threat so far: beneath 3 (2.5 rounded), a fair match 5, above 8, far above 10, far beneath none', () => {
    const got = [1, 2, 3, 4, 0].map(threat => spend(make(threat)).practice);
    assert.deepEqual(got, [3, 5, 8, 10, 0]);
});

test('`~ spend` takes the threat of the latest earlier reply when the reply named none', () => {
    const slice = make();
    slice.dice[SIDS[0]].threat = 3;
    assert.equal(spend(slice, 'Obscure', { sid: SIDS[1] }).practice, 8);
});

test('the same skill gains from `~ spend` once a reply: a second line adds nothing, another skill or another reply gains', () => {
    const slice = make();
    assert.equal(spend(slice).practice, 5);
    assert.equal(spend(slice).practice, 0, 'the second use in the reply');
    assert.equal(obscure(slice), 5);
    assert.equal(spend(slice, 'Obscure', { sid: SIDS[1] }).practice, 5, 'the next reply');
    assert.equal(obscure(slice), 10);
});

test('a roll for the skill in the same reply wins over `~ spend`, in either order: the reply teaches the roll\'s points only', () => {
    const after = make();
    assert.equal(spend(after).practice, 5);
    const rolled = attempt(after, 'Obscure', 'normal');
    assert.equal(rolled.practice, 10);
    assert.equal(obscure(after), 10, 'the spend before the roll gave its 5 back');
    assert.equal(spend(after).practice, 0, 'and a spend after the roll adds nothing');
    const before = make();
    assert.equal(attempt(before, 'Obscure', 'normal').practice, 10);
    assert.equal(spend(before).practice, 0);
    assert.equal(obscure(before), 10);
});

test('a roll teaches by the threat it was made under: +10, +20 for a success at hard or harder, scaled; nothing far beneath', () => {
    const fair = attempt(make(), 'Lore', 'normal', { labels: { threat: 'a fair match' } });
    assert.equal(fair.practice, 10);
    const above = make();
    above.dice[SIDS[0]].list = [18, 11, 11];
    assert.equal(attempt(above, 'Lore', 'hard', { labels: { threat: 'above you' } }).practice, 20 + 10, 'a hard success (18 + 1 over 16): 20 ×1.5');
    assert.equal(lore(above), 30);
    const beneath = make();
    assert.equal(attempt(beneath, 'Lore', 'normal', { labels: { threat: 'beneath you' } }).practice, 5);
    const none = make();
    assert.equal(attempt(none, 'Lore', 'normal', { labels: { threat: 'far beneath you' } }).practice, 0);
    assert.equal(lore(none), 0, 'a far beneath roll teaches nothing');
    assert.equal(attempt(make(), 'Lore', 'normal').practice, 10, 'no threat said: counts whole');
});

test('a rank up from `~ spend` is told', () => {
    const slice = make();
    slice.members.ac_astra001.practice.obscure = 97;
    assert.equal(spend(slice).rankUp, 'Apprentice');
});

test('a spend near the cap marks only what it really added, so the roll takes back only that', () => {
    const slice = make();
    slice.members.ac_astra001.practice.obscure = 597;
    assert.equal(spend(slice).practice, 5, 'the receipt says the points of the line');
    assert.equal(obscure(slice), 600, 'capped');
    assert.equal(slice.spent[SIDS[0]].obscure, 3, 'the mark holds the 3 that were added');
    attempt(slice, 'Obscure', 'normal');
    assert.equal(obscure(slice), 600, '597 + the roll\'s 10, capped: only the 3 taken back, not the 5');
});
