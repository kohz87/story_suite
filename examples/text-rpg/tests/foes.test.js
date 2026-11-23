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
const set = (slice, name, count, kind = 'common', sid = SID, ctx = fakeCtx(slice, { sid })) => run(applyFoes, ctx, { ...line('foes', name, '', { count, kind }), op: '+' });
const end = (slice, name) => run(applyFoes, fakeCtx(slice, { sid: NEXT }), { ...line('foes', name), op: '-' });

test('+ foes sets a group up: its count, its threat and the fight it belongs to, kept in the domain and valid', () => {
    const slice = sliceOf([astra()]);
    const done = set(slice, 'Sewer rats', '24', 'vermin');
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(slice.foes.groups['sewer-rats'], { name: 'Sewer rats', kind: 'vermin', threat: 1, count: 24, left: 24, fight: SID, at: null, sid: SID });
    assert.deepEqual(slice.foes.fights[SID], { rolled: {}, taught: [] });
    assert.deepEqual(done.result.data, { group: 'sewer-rats', name: 'Sewer rats', count: 24, kind: 'vermin', threat: 1, reinforcements: false, left: 24 });
    assert.match(done.result.summary, /^Foes set: Sewer rats: vermin, minor for you \(24\)\./);
    assert.deepEqual(validate(slice), []);
    assert.deepEqual(standing(slice).map(([id]) => id), ['sewer-rats']);
});

test('the kind sets the threat against the party\'s level; a bad count or kind is refused and writes nothing', () => {
    const got = ['vermin', 'common', 'trained', 'elite', 'monster', 'legend'].map((kind, at) => { const slice = sliceOf([astra()]); set(slice, `g${at}`, '2', kind); return slice.foes.groups[`g${at}`].threat; });
    assert.deepEqual(got, [1, 2, 3, 4, 5, 5]);
    for (const [count, kind] of [['0', 'vermin'], ['x', 'vermin'], ['', 'vermin'], ['100', 'vermin'], ['3', 'mighty'], ['3', '']]) {
        const slice = sliceOf([astra()]);
        assert.equal(set(slice, 'rats', count, kind).code, 'INVALID', `${count} / ${kind}`);
        assert.equal(slice.foes, undefined, 'a refused line writes nothing');
    }
    assert.equal(run(applyFoes, fakeCtx(sliceOf([astra()])), { ...line('foes', '***', '', { count: '2', kind: 'vermin' }), op: '+' }).code, 'INVALID', 'a name with no letters');
});

test('an old line with threat: and no kind is refused with the receipt that names the kinds, and writes nothing; a threat: beside a kind is ignored', () => {
    const slice = sliceOf([astra()]);
    const old = run(applyFoes, fakeCtx(slice, { sid: SID }), { ...line('foes', 'Rats', '', { count: '24', threat: 'a fair match' }), op: '+' });
    assert.equal(old.code, 'INVALID');
    assert.equal(old.message, '+ foes needs a kind: vermin, common, trained, elite, monster or legend');
    assert.equal(slice.foes, undefined);
    const both = run(applyFoes, fakeCtx(slice, { sid: SID }), { ...line('foes', 'Rats', '', { count: '24', kind: 'vermin', threat: 'beyond you' }), op: '+' });
    assert.equal(both.ok, true, both.message);
    assert.equal(slice.foes.groups.rats.threat, 1, 'the kind rules');
});

test('a reply sets up at most six groups, and a name only once', () => {
    const slice = sliceOf([astra()]);
    const ctx = fakeCtx(slice);
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) assert.equal(set(slice, name, '2', 'vermin', SID, ctx).ok, true, name);
    assert.equal(set(slice, 'g', '2', 'vermin', SID, ctx).code, 'LIMITED');
    assert.equal(slice.foes.groups.g, undefined);
    assert.equal(set(slice, 'a', '2', 'vermin', SID, ctx).code, 'LIMITED', 'the same name twice in one reply');
    assert.equal(set(slice, 'g', '2', 'vermin', NEXT).ok, true, 'the next reply has its own six');
});

test('the same name and kind in a later reply, while some stand, is reinforcements: counts add and it says so; another kind is a new group', () => {
    const slice = sliceOf([astra()]);
    set(slice, 'Wolves', '4', 'common');
    run(applyFoes, fakeCtx(slice, { sid: NEXT }), { ...line('foes', 'wolves', '', { count: '3', kind: 'common' }), op: '+' });
    assert.deepEqual(slice.foes.groups.wolves, { name: 'Wolves', kind: 'common', threat: 2, count: 7, left: 7, fight: SID, at: null, sid: NEXT });
    const other = run(applyFoes, fakeCtx(slice, { sid: NEXT }), { ...line('foes', 'wolves', '', { count: '2', kind: 'trained' }), op: '+' });
    assert.deepEqual([slice.foes.groups.wolves.left, slice.foes.groups.wolves.threat, other.result.data.reinforcements], [7, 2, false], 'the old group keeps its threat');
    assert.deepEqual(slice.foes.groups['wolves-2'], { name: 'wolves 2', kind: 'trained', threat: 3, count: 2, left: 2, fight: SID, at: null, sid: NEXT });
    assert.match(other.result.summary, /^Foes set: wolves 2: trained, above you \(2\)/);
    const again = run(applyFoes, fakeCtx(slice, { sid: 'sw_reply0004' }), { ...line('foes', 'wolves', '', { count: '5', kind: 'trained' }), op: '+' });
    assert.deepEqual([slice.foes.groups['wolves-2'].left, again.result.data.reinforcements], [7, true], 'the same threat adds to Wolves 2');
    assert.deepEqual(validate(slice), []);
    const hurt = sliceOf([astra()]);
    set(hurt, 'Wolves', '4');
    hurt.foes.groups.wolves.left = 1;
    const more = run(applyFoes, fakeCtx(hurt, { sid: NEXT }), { ...line('foes', 'Wolves', '', { count: '2', kind: 'common' }), op: '+' });
    assert.deepEqual([hurt.foes.groups.wolves.count, hurt.foes.groups.wolves.left, more.result.data.reinforcements], [6, 3, true]);
    assert.match(more.result.summary, /^Reinforcements: 2 more Wolves; now Wolves: common, even for you \(3\)\./);
    assert.equal(Object.keys(hurt.foes.fights).length, 1, 'the same fight');
});

test('a group that is closed is not reinforced: the same name later is a new group, and a new fight when none stands', () => {
    const slice = sliceOf([astra()]);
    set(slice, 'Wolves', '4');
    slice.foes.groups.wolves.left = 0;
    set(slice, 'Wolves', '2', 'trained', NEXT);
    assert.deepEqual(slice.foes.groups.wolves, { name: 'Wolves', kind: 'trained', threat: 3, count: 2, left: 2, fight: NEXT, at: null, sid: NEXT });
    assert.deepEqual(Object.keys(slice.foes.fights), [SID, NEXT]);
    assert.equal(latestFight(slice).id, NEXT);
});

test('a group set up while others stand joins their fight', () => {
    const slice = sliceOf([astra()]);
    set(slice, 'Wolves', '4');
    set(slice, 'Rats', '9', 'vermin', NEXT);
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
        set(slice, `Band ${at}`, '2', 'vermin', `sw_fight${String(at).padStart(4, '0')}`);
        slice.foes.groups[groupId(`Band ${at}`)].left = 0;
    }
    assert.ok(Object.keys(slice.foes.fights).length <= 8);
    assert.ok(Object.values(slice.foes.groups).every(group => slice.foes.fights[group.fight]));
    assert.deepEqual(validate(slice), []);
    assert.equal(run(applyFoes, fakeCtx(sliceOf([astra()]), { on: false }), { ...line('foes', 'rats', '', { count: '2', kind: 'vermin' }), op: '+' }).code, 'FEATURE_OFF');
});

test('stale groups: a day or more of story time past the reply that touched them closes them for the matchup, xp and lessons; with no clock they stay', () => {
    const slice = sliceOf([astra()], { list: [10, 10, 10], floor: 0, clock: 100 });
    set(slice, 'rats', '3', 'common');
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
    const xp = run(applyXp, fakeCtx(slice, { sid: NEXT }), line('xp', 'Party', 'x', { foes: '2' }));
    assert.equal(slice.foes.groups.rats.left, 3, 'nothing counted down in a stale group');
    assert.equal(xp.result.data.foes, 0);
});

test('new foes in a reply after one that hit none of the standing groups close those (fled); a hit or the same reply keeps them', () => {
    const base = () => {
        const slice = sliceOf([astra()]);
        slice.dice.sw_reply0002 = { list: [10], floor: 0 };
        slice.dice.sw_reply0003 = { list: [10], floor: 0 };
        set(slice, 'rats', '3', 'vermin', SID);
        return slice;
    };
    const apart = base();
    set(apart, 'bandits', '2', 'common', 'sw_reply0003');
    assert.deepEqual([apart.foes.groups.rats.left, apart.foes.groups.rats.fled, apart.foes.groups.bandits.left], [0, true, 2]);
    assert.equal(latestFight(apart).open, true);
    const near = base();
    set(near, 'bandits', '2', 'common', 'sw_reply0002');
    assert.equal(near.foes.groups.rats.left, 3, 'the reply after the one that touched them');
    const hit = base();
    hit.foes.groups.rats.sid = 'sw_reply0002';
    set(hit, 'bandits', '2', 'common', 'sw_reply0003');
    assert.equal(hit.foes.groups.rats.left, 3, 'touched in the reply before');
});
