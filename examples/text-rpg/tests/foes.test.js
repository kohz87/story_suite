// `+ foes` and `- foes`: the foes record the narrator sets up before a fight (one `slice.foes`, keyed by group id), its limits, reinforcements and ending.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFoes } from '../src/module-parts/kinds/foes.js';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { matchupOf } from '../src/module-parts/matchup.js';
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
    assert.deepEqual(slice.foes.groups['sewer-rats'], { name: 'Sewer rats', threat: 1, count: 24, left: 24, fight: SID, at: null, sid: SID });
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

test('the same name and threat in a later reply, while some stand, is reinforcements: counts add and it says so; another threat is a new group', () => {
    const slice = sliceOf([astra()]);
    set(slice, 'Wolves', '4', 'a fair match');
    run(applyFoes, fakeCtx(slice, { sid: NEXT }), { ...line('foes', 'wolves', '', { count: '3', threat: 'a fair match' }), op: '+' });
    assert.deepEqual(slice.foes.groups.wolves, { name: 'Wolves', threat: 2, count: 7, left: 7, fight: SID, at: null, sid: NEXT });
    const other = run(applyFoes, fakeCtx(slice, { sid: NEXT }), { ...line('foes', 'wolves', '', { count: '2', threat: 'above you' }), op: '+' });
    assert.deepEqual([slice.foes.groups.wolves.left, slice.foes.groups.wolves.threat, other.result.data.reinforcements], [7, 2, false], 'the old group keeps its threat');
    assert.deepEqual(slice.foes.groups['wolves-2'], { name: 'wolves 2', threat: 3, count: 2, left: 2, fight: SID, at: null, sid: NEXT });
    assert.match(other.result.summary, /^Foes set: 2 wolves 2 \(above\)/);
    const again = run(applyFoes, fakeCtx(slice, { sid: 'sw_reply0004' }), { ...line('foes', 'wolves', '', { count: '5', threat: 'above you' }), op: '+' });
    assert.deepEqual([slice.foes.groups['wolves-2'].left, again.result.data.reinforcements], [7, true], 'the same threat adds to Wolves 2');
    assert.deepEqual(validate(slice), []);
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
    assert.deepEqual(slice.foes.groups.wolves, { name: 'Wolves', threat: 3, count: 2, left: 2, fight: NEXT, at: null, sid: NEXT });
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

test('stale groups: a day or more of story time past the reply that touched them closes them for the matchup, xp and lessons; with no clock they stay', () => {
    const slice = sliceOf([astra()], { list: [10, 10, 10], floor: 0, clock: 100 });
    set(slice, 'rats', '3', 'a fair match');
    slice.foes.groups.rats.at = 100;
    slice.dice[NEXT] = { list: [10, 10, 10], floor: 0, clock: 100 + 1439 };
    assert.equal(standing(slice, 100 + 1439).length, 1, 'less than a day');
    assert.equal(standing(slice, 100 + 1440).length, 0, 'a day');
    assert.equal(latestFight(slice, 100 + 1440).open, false);
    assert.equal(matchupOf(slice, () => ({}), 100 + 1440), null);
    assert.equal(standing(slice, null).length, 1, 'with no clock they stay');
    slice.foes.groups.rats.at = null;
    assert.equal(standing(slice, 99999).length, 1, 'a group made with no clock stays');
    slice.foes.groups.rats.at = 100;
    slice.dice[NEXT].clock = 100 + 2000;
    const xp = run(applyXp, fakeCtx(slice, { sid: NEXT }), line('xp', 'Party', 'x', { size: 'minor', foes: '2' }));
    assert.equal(slice.foes.groups.rats.left, 3, 'nothing counted down in a stale group');
    assert.equal(xp.result.data.foes, 1);
});

test('new foes in a reply after one that hit none of the standing groups close those (fled); a hit or the same reply keeps them', () => {
    const base = () => {
        const slice = sliceOf([astra()]);
        slice.dice.sw_reply0002 = { list: [10], floor: 0 };
        slice.dice.sw_reply0003 = { list: [10], floor: 0 };
        set(slice, 'rats', '3', 'beneath you', SID);
        return slice;
    };
    const apart = base();
    set(apart, 'bandits', '2', 'a fair match', 'sw_reply0003');
    assert.deepEqual([apart.foes.groups.rats.left, apart.foes.groups.rats.fled, apart.foes.groups.bandits.left], [0, true, 2]);
    assert.equal(latestFight(apart).open, true);
    const near = base();
    set(near, 'bandits', '2', 'a fair match', 'sw_reply0002');
    assert.equal(near.foes.groups.rats.left, 3, 'the reply after the one that touched them');
    const hit = base();
    hit.foes.groups.rats.sid = 'sw_reply0002';
    set(hit, 'bandits', '2', 'a fair match', 'sw_reply0003');
    assert.equal(hit.foes.groups.rats.left, 3, 'touched in the reply before');
});
