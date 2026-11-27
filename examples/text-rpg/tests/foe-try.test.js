// `? try` in a fight: the strongest standing group (or `against:`) sets the difficulty; the narrator's word counts only with no foes standing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFoes } from '../src/module-parts/kinds/foes.js';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { foeFor } from '../src/module-parts/foe-pick.js';
import { SID, astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

const NEXT = 'sw_reply0002';
const dice = (extra = {}) => ({ list: [15, 15, 15], floor: 0, ...extra });
const world = () => { const slice = sliceOf([astra()], dice()); slice.dice[NEXT] = dice(); return slice; };
const declare = (slice, name, kind, count = 3, sid = SID) => run(applyFoes, fakeCtx(slice, { sid }), { ...line('foes', name, '', { count: String(count), kind }), op: '+' });
const tryAt = (slice, word, labels = {}, sid = NEXT) => run(applyTry, fakeCtx(slice, { sid }), line('try', 'Astra', `Lore; ${word}`, labels));

test('with foes standing the strongest group starts the difficulty: its threat is the starting step, whatever word is written', () => {
    const slice = world();
    declare(slice, 'Rats', 'vermin');
    declare(slice, 'Guards', 'trained');
    assert.equal(tryAt(slice, 'trivial').result.data.difficulty, 3, 'trained at level 1 is above: hard');
    assert.equal(tryAt(slice, 'near impossible', {}, SID).result.data.difficulty, 3);
});

test('`against: Name` picks the group; an unknown name falls back to the strongest and says so', () => {
    const slice = world();
    declare(slice, 'Rats', 'vermin');
    declare(slice, 'Guards', 'trained');
    const rats = tryAt(slice, 'hard', { against: 'rats' });
    assert.equal(rats.result.data.difficulty, 1, 'vermin: easy');
    const nobody = tryAt(slice, 'hard', { against: 'dragons' });
    assert.equal(nobody.result.data.difficulty, 3);
    assert.match(nobody.result.summary, /no foes called dragons stand, the strongest used/);
    assert.deepEqual([foeFor(slice, 'Guards').group.name, foeFor(slice, '').group.name, foeFor(slice, 'guards').missed], ['Guards', 'Guards', false]);
});

test('the narrator\'s word is ignored while foes stand, and the receipt says so; a word that agrees is not noted', () => {
    const slice = world();
    declare(slice, 'Wolves', 'common');
    const said = tryAt(slice, 'trivial');
    assert.equal(said.result.data.difficulty, 2);
    assert.match(said.result.summary, /; difficulty word ignored: foes stand/);
    assert.doesNotMatch(tryAt(slice, 'ordinary').result.summary, /ignored/);
});

test('an edge of ±2 with a reason, a live condition and a drained body still move the foe\'s start; no reason, no edge', () => {
    const slice = world();
    declare(slice, 'Wolves', 'common');
    assert.equal(tryAt(slice, 'ordinary', { edge: '+2 (a trap set before)' }).result.data.difficulty, 0);
    const none = tryAt(slice, 'ordinary', { edge: '+2' });
    assert.equal(none.result.data.difficulty, 2);
    const hurt = world();
    declare(hurt, 'Wolves', 'common');
    hurt.members.ac_astra001.conditions = [{ name: 'poisoned', until: 'treated' }];
    assert.equal(tryAt(hurt, 'ordinary').result.data.difficulty, 3, 'a live condition adds a step against foes');
});

test('with no foes standing the narrator\'s word sets the difficulty as before; closed groups do not rate it', () => {
    const slice = world();
    assert.equal(tryAt(slice, 'hard').result.data.difficulty, 3);
    declare(slice, 'Rats', 'vermin');
    slice.foes.groups.rats.left = 0;
    assert.equal(tryAt(slice, 'easy').result.data.difficulty, 1);
    assert.equal(foeFor(slice, '').group, null);
});

test('the group\'s threat is recorded for the reply (for practice) and a success is noted for the xp', () => {
    const slice = world();
    declare(slice, 'Guards', 'trained');
    slice.dice[NEXT].list = [20, 20, 20];
    tryAt(slice, 'hard');
    assert.deepEqual([slice.dice[NEXT].threat, slice.dice[NEXT].won, slice.dice[NEXT].hardest], [3, true, 3]);
});

test('old lines are ignored: a threat: on ? try starts nothing, with no foes standing or beside a group of a kind', () => {
    const slice = world();
    assert.equal(tryAt(slice, 'easy', { threat: 'above you' }).result.data.difficulty, 1, 'the narrator\'s word stands: no threat is read from the line');
    assert.equal(slice.dice[NEXT].threat, undefined, 'and no threat is recorded');
    const old = world();
    assert.equal(run(applyFoes, fakeCtx(old, { sid: SID }), { ...line('foes', 'Rats', '', { count: '3', threat: 'beneath you' }), op: '+' }).code, 'INVALID', 'an old + foes makes no group');
    assert.equal(tryAt(old, 'hard', { threat: 'a fair match' }).result.data.difficulty, 3, 'so the word hard stands');
    const kinded = world();
    declare(kinded, 'Wolves', 'common');
    assert.equal(tryAt(kinded, 'hard', { threat: 'beyond you' }).result.data.difficulty, 2, 'a narrator writing threat: out of habit changes nothing');
});
