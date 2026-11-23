// `+ foes` and `- foes`: the foes record the narrator sets up before a fight (one `slice.foes`, keyed by group id), its limits, reinforcements and ending.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFoes } from '../src/module-parts/kinds/foes.js';
import { validate } from '../src/domain/validate.js';
import { groupId, latestFight, standing } from '../src/module-parts/foes-record.js';
import { SID, astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { leftOf } from './helpers/foes.js';

const NEXT = 'sw_reply0002';
const set = (slice, name, count, threat = 'a fair match', sid = SID, ctx = fakeCtx(slice, { sid })) => run(applyFoes, ctx, { ...line('foes', name, '', { count, threat }), op: '+' });
const end = (slice, name) => run(applyFoes, fakeCtx(slice, { sid: NEXT }), { ...line('foes', name), op: '-' });

test('+ foes sets a group up: its count, its threat and the fight it belongs to, kept in the domain and valid', () => {
    const slice = sliceOf([astra()]);
    const done = set(slice, 'Sewer rats', '24', 'beneath you');
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(slice.foes.groups['sewer-rats'], { name: 'Sewer rats', threat: 1, count: 24, left: 24, fight: SID });
    assert.deepEqual(slice.foes.fights[SID], { rolled: {}, taught: [] });
    assert.deepEqual(done.result.data, { group: 'sewer-rats', name: 'Sewer rats', count: 24, threat: 1, reinforcements: false, left: 24 });
    assert.match(done.result.summary, /^Foes set: 24 Sewer rats \(beneath\)\./);
    assert.deepEqual(validate(slice), []);
    assert.deepEqual(standing(slice).map(([id]) => id), ['sewer-rats']);
});

test('the threat reads the sheet\'s words and their short forms; a bad count or threat is refused and writes nothing', () => {
    const got = ['far beneath you', 'beneath', 'a fair match', 'above you', 'far above', 'beyond you'].map((word, at) => { const slice = sliceOf([astra()]); set(slice, `g${at}`, '2', word); return slice.foes.groups[`g${at}`].threat; });
    assert.deepEqual(got, [0, 1, 2, 3, 4, 5]);
    for (const [count, threat] of [['0', 'beneath'], ['x', 'beneath'], ['', 'beneath'], ['100', 'beneath'], ['3', 'mighty'], ['3', '']]) {
        const slice = sliceOf([astra()]);
        assert.equal(set(slice, 'rats', count, threat).code, 'INVALID', `${count} / ${threat}`);
        assert.equal(slice.foes, undefined, 'a refused line writes nothing');
    }
    assert.equal(run(applyFoes, fakeCtx(sliceOf([astra()])), { ...line('foes', '***', '', { count: '2', threat: 'beneath' }), op: '+' }).code, 'INVALID', 'a name with no letters');
});

test('a reply sets up at most six groups, and a name only once', () => {
    const slice = sliceOf([astra()]);
    const ctx = fakeCtx(slice);
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) assert.equal(set(slice, name, '2', 'beneath', SID, ctx).ok, true, name);
    assert.equal(set(slice, 'g', '2', 'beneath', SID, ctx).code, 'LIMITED');
    assert.equal(slice.foes.groups.g, undefined);
    assert.equal(set(slice, 'a', '2', 'beneath', SID, ctx).code, 'LIMITED', 'the same name twice in one reply');
    assert.equal(set(slice, 'g', '2', 'beneath', NEXT).ok, true, 'the next reply has its own six');
});

test('the same name in a later reply, while some stand, is reinforcements: counts add, the threat is the new one, and it says so', () => {
    const slice = sliceOf([astra()]);
    set(slice, 'Wolves', '4', 'a fair match');
    run(applyFoes, fakeCtx(slice, { sid: NEXT }), { ...line('foes', 'wolves', '', { count: '3', threat: 'above you' }), op: '+' });
    assert.deepEqual(slice.foes.groups.wolves, { name: 'Wolves', threat: 3, count: 7, left: 7, fight: SID });
    const hurt = sliceOf([astra()]);
    set(hurt, 'Wolves', '4');
    hurt.foes.groups.wolves.left = 1;
    const more = run(applyFoes, fakeCtx(hurt, { sid: NEXT }), { ...line('foes', 'Wolves', '', { count: '2', threat: 'a fair match' }), op: '+' });
    assert.deepEqual([hurt.foes.groups.wolves.count, hurt.foes.groups.wolves.left, more.result.data.reinforcements], [6, 3, true]);
    assert.match(more.result.summary, /^Reinforcements: 2 more Wolves \(a fair match\); 3 stand\./);
    assert.equal(Object.keys(hurt.foes.fights).length, 1, 'the same fight');
});

test('a group that is closed is not reinforced: the same name later is a new group, and a new fight when none stands', () => {
    const slice = sliceOf([astra()]);
    set(slice, 'Wolves', '4');
    slice.foes.groups.wolves.left = 0;
    set(slice, 'Wolves', '2', 'above you', NEXT);
    assert.deepEqual(slice.foes.groups.wolves, { name: 'Wolves', threat: 3, count: 2, left: 2, fight: NEXT });
    assert.deepEqual(Object.keys(slice.foes.fights), [SID, NEXT]);
    assert.equal(latestFight(slice).id, NEXT);
});

test('a group set up while others stand joins their fight', () => {
    const slice = sliceOf([astra()]);
    set(slice, 'Wolves', '4');
    set(slice, 'Rats', '9', 'beneath you', NEXT);
    assert.deepEqual([slice.foes.groups.rats.fight, Object.keys(slice.foes.fights)], [SID, [SID]]);
    assert.deepEqual(latestFight(slice).groups.map(([id]) => id), ['wolves', 'rats']);
});

test('- foes ends a group (fled or scattered): no one stands, nothing is paid, and the fight can end', () => {
    const slice = sliceOf([astra()]);
    set(slice, 'Wolves', '4');
    const gone = end(slice, 'Wolves');
    assert.equal(gone.ok, true, gone.message);
    assert.deepEqual([leftOf(slice), slice.foes.groups.wolves.count, slice.members.ac_astra001.xp], [{ wolves: 0 }, 4, 0]);
    assert.match(gone.result.summary, /gone from the fight.*no XP/);
    assert.equal(latestFight(slice).open, false);
    assert.equal(end(slice, 'Wolves').code, 'NOT_FOUND', 'already gone');
    assert.equal(end(slice, 'Trolls').code, 'NOT_FOUND');
    assert.deepEqual(validate(slice), []);
});

test('the record keeps itself small: old fights go, and a record is refused while Text RPG is off', () => {
    const slice = sliceOf([astra()]);
    for (let at = 0; at < 12; at += 1) {
        set(slice, `Band ${at}`, '2', 'beneath', `sw_fight${String(at).padStart(4, '0')}`);
        slice.foes.groups[groupId(`Band ${at}`)].left = 0;
    }
    assert.ok(Object.keys(slice.foes.fights).length <= 8);
    assert.ok(Object.values(slice.foes.groups).every(group => slice.foes.fights[group.fight]));
    assert.deepEqual(validate(slice), []);
    assert.equal(run(applyFoes, fakeCtx(sliceOf([astra()]), { on: false }), { ...line('foes', 'rats', '', { count: '2', threat: 'beneath' }), op: '+' }).code, 'FEATURE_OFF');
});
