// `+ lesson Who — Skill | what`: 5 × the fight's threat multiplier, once a skill a fight, only for a skill that member rolled in it, after its foes are all down or gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLesson } from '../src/module-parts/kinds/lesson.js';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { validate } from '../src/domain/validate.js';
import { SID, astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { leftOf, withFoes } from './helpers/foes.js';

const lesson = (slice, skill = 'Lore', who = 'Astra', sid = 'sw_reply0002') => run(applyLesson, fakeCtx(slice, { sid }), line('lesson', who, `${skill}; it was learned`));
const roll = (slice, what = 'Lore', who = 'Astra') => run(applyTry, fakeCtx(slice, { sid: SID }), line('try', who, `${what}; ordinary`));
// A fight of `groups` in which Astra rolled Lore (and the groups closed when `closed`).
const fight = (groups, { closed = true, rolled = ['lore'] } = {}) => {
    const slice = withFoes(sliceOf([astra(), astra({ id: 'ac_bram0001', name: 'Bram', pc: false })], { list: [15, 15, 15], floor: 0 }), groups);
    slice.foes.fights.sw_before001.rolled.ac_astra001 = rolled;
    if (closed) for (const group of Object.values(slice.foes.groups)) group.left = 0;
    return slice;
};
const lore = slice => slice.members.ac_astra001.practice.lore ?? 0;

test('a lesson is 5 × the fight\'s threat multiplier: far beneath nothing, beneath 3, fair 5, above 10, far above 15, beyond 20', () => {
    const got = [1, 2, 3, 4, 5].map(threat => { const slice = fight([['foes', 3, threat]]); const done = lesson(slice); return [done.result.data.practice, lore(slice)]; });
    assert.deepEqual(got, [[3, 3], [5, 5], [10, 10], [15, 15], [20, 20]]);
    const none = fight([['foes', 3, 0]]);
    assert.equal(lesson(none).code, 'REFUSED', 'foes that far beneath teach nothing');
    assert.equal(lore(none), 0);
    assert.deepEqual(validate(fight([['foes', 3, 2]])), []);
});

test('the fight\'s threat is its strongest group\'s, and a rank up is told', () => {
    const slice = fight([['rats', 20, 1], ['ogre', 1, 3]]);
    slice.members.ac_astra001.practice.lore = 35;
    const done = lesson(slice);
    assert.deepEqual([done.result.data.practice, lore(slice), done.result.data.rankUp], [10, 45, 'Apprentice']);
    assert.match(done.result.summary, /^Astra learned from the fight: Lore \+10 \(reaches Apprentice\)\./);
});

test('the lesson\'s size is the strongest group that fell: a group that fled does not count', () => {
    const slice = fight([['rats', 20, 1], ['ogre', 1, 3]]);
    slice.foes.groups.ogre.fled = true;
    assert.equal(lesson(slice).result.data.practice, 3, 'beneath: 3, not above: 10');
    const none = fight([['ogre', 1, 3]]);
    none.foes.groups.ogre.fled = true;
    assert.equal(lesson(none).code, 'REFUSED', 'nothing fell');
});

test('once a skill a fight for each member: a second lesson is refused, another skill or another fight is not', () => {
    const slice = fight([['rats', 3, 2]], { rolled: ['lore', 'obscure'] });
    assert.equal(lesson(slice).ok, true);
    assert.equal(lesson(slice).code, 'LIMITED');
    assert.equal(lore(slice), 5);
    assert.equal(lesson(slice, 'Obscure').ok, true, 'another skill');
    assert.equal(slice.members.ac_astra001.practice.obscure, 5);
    withFoes(slice, [['wolves', 2, 3]], 'sw_before002');
    slice.foes.groups.wolves.left = 0;
    slice.foes.fights.sw_before002.rolled.ac_astra001 = ['lore'];
    assert.equal(lesson(slice).result?.data.practice, 10, 'a new fight teaches the skill again');
    assert.equal(lore(slice), 15);
});

test('only a skill the member rolled in that fight: not another member\'s roll, not a skill they never rolled, not a skill off the sheet', () => {
    const slice = fight([['rats', 3, 2]]);
    assert.equal(lesson(slice, 'Lore', 'Bram').code, 'REFUSED', 'Bram did not roll it');
    assert.equal(lesson(slice, 'Obscure').code, 'REFUSED', 'Astra rolled Lore, not Obscure');
    assert.equal(lesson(slice, 'Juggling').code, 'NOT_FOUND');
    assert.equal(lesson(slice, 'Lore', 'Nobody').code, 'NOT_FOUND');
    assert.equal(lore(slice), 0);
});

test('after all its groups are closed or gone, or in the same reply they close; never while one stands', () => {
    const open = fight([['rats', 3, 2], ['wolves', 2, 2]], { closed: false });
    open.foes.groups.rats.left = 0;
    assert.equal(lesson(open).code, 'REFUSED', 'the wolves stand');
    open.foes.groups.wolves.left = 0;
    assert.equal(lesson(open).ok, true, 'fled (left 0) or fallen: the fight is over');
    assert.equal(run(applyLesson, fakeCtx(sliceOf([astra()])), line('lesson', 'Astra', 'Lore')).code, 'REFUSED', 'no fight was set up');
    // The same reply: xp closes the group (it applies first), then the lesson.
    const same = fight([['rats', 3, 2]], { closed: false });
    const paid = run(applyXp, fakeCtx(same, { sid: 'sw_reply0002' }), line('xp', 'Party', 'rats', { size: 'minor', foes: '3' }));
    assert.deepEqual([paid.result.data.amount, leftOf(same)], [0, { rats: 0 }], 'a reply that rolled nothing pays nothing but still counts the foes down');
    assert.equal(lesson(same).ok, true);
});

test('a roll counts toward a fight only while foes stand: before they were set up or after they fell it teaches nothing', () => {
    const slice = sliceOf([astra()], { list: [15, 15, 15], floor: 0 });
    roll(slice);
    withFoes(slice, [['rats', 3, 2]], SID);
    assert.deepEqual(slice.foes.fights[SID].rolled, {}, 'a roll before the foes were set up');
    roll(slice);
    assert.deepEqual(slice.foes.fights[SID].rolled, { ac_astra001: ['lore'] }, 'a roll while they stand');
    roll(slice, 'Lore');
    assert.deepEqual(slice.foes.fights[SID].rolled.ac_astra001, ['lore'], 'once');
    roll(slice, 'str');
    roll(slice, 'Juggling');
    assert.deepEqual(slice.foes.fights[SID].rolled.ac_astra001, ['lore'], 'a stat try or a skill off the sheet is no skill rolled');
    slice.foes.groups.rats.left = 0;
    slice.foes.fights[SID].rolled = {};
    slice.dice[SID].used = 0;
    roll(slice);
    assert.deepEqual(slice.foes.fights[SID].rolled, {}, 'a roll after they fell');
});
