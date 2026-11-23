// The foe kind ladder: the code rates `kind:` against the party's level and fixes that threat on the group when it is declared.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFoes } from '../src/module-parts/kinds/foes.js';
import { threatFor } from '../src/rules/foe-ladder.js';
import { KINDS, foeLine, foeWords, readKind } from '../src/words/foe-kinds.js';
import { partyLevel } from '../src/module-parts/foe-pick.js';
import { validate } from '../src/domain/validate.js';
import { SID, astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

const NEXT = 'sw_reply0002';
const at = level => astra({ xp: (level - 1) * 100 });
const declare = (slice, name, kind, count = 3, sid = SID, extra = {}) => run(applyFoes, fakeCtx(slice, { sid }), { ...line('foes', name, '', { count: String(count), kind, ...extra }), op: '+' });

test('the ladder against the level bands: base 1..6 less 0, 1, 2, 3 at levels 1-9, 10-29, 30-59, 60+, kept within 0..5', () => {
    const table = Object.fromEntries([1, 9, 10, 29, 30, 59, 60, 99].map(level => [level, KINDS.map(kind => threatFor(kind, level))]));
    assert.deepEqual(table, {
        1: [1, 2, 3, 4, 5, 5], 9: [1, 2, 3, 4, 5, 5],
        10: [0, 1, 2, 3, 4, 5], 29: [0, 1, 2, 3, 4, 5],
        30: [0, 0, 1, 2, 3, 4], 59: [0, 0, 1, 2, 3, 4],
        60: [0, 0, 0, 1, 2, 3], 99: [0, 0, 0, 1, 2, 3],
    });
});

test('the kind words: read in any case, anything else is none; the plain words a reader sees', () => {
    assert.deepEqual(KINDS, ['vermin', 'common', 'trained', 'elite', 'monster', 'legend']);
    assert.deepEqual([' Vermin ', 'LEGEND', 'dragon', '', undefined].map(readKind), ['vermin', 'legend', null, null, null]);
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => foeWords('common', threat)), ['common, trivial for you', 'common, minor for you', 'common, even for you', 'common, above you', 'common, far above you', 'common, beyond you']);
    assert.equal(foeLine('Rats', 'vermin', 1, 24), 'Rats: vermin, minor for you (24)');
    assert.equal(foeWords(undefined, 1), 'minor for you', 'a group from an old chat has no kind');
});

test('+ foes kind: sets the group with the threat the code rated, and the kind is stored on it', () => {
    const slice = sliceOf([at(1)]);
    const done = declare(slice, 'Rats', 'vermin', 24);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(slice.foes.groups.rats, { name: 'Rats', kind: 'vermin', threat: 1, count: 24, left: 24, fight: SID, at: null, sid: SID });
    assert.deepEqual(done.result.data, { group: 'rats', name: 'Rats', count: 24, kind: 'vermin', threat: 1, reinforcements: false, left: 24 });
    assert.equal(done.result.summary, 'Foes set: Rats: vermin, minor for you (24).');
    assert.deepEqual(validate(slice), []);
});

test('the party level is the highest among members not fallen or Down', () => {
    const high = astra({ id: 'ac_high0001', name: 'High', pc: false, xp: 1200 });
    assert.equal(partyLevel(sliceOf([at(1), high])), 13);
    high.fallen = true;
    assert.equal(partyLevel(sliceOf([at(1), high])), 1, 'a fallen member does not count');
    const down = astra({ id: 'ac_down0001', name: 'Down', pc: false, xp: 3000, down: true });
    assert.equal(partyLevel(sliceOf([at(2), down])), 2, 'a Down member does not count');
    assert.equal(partyLevel(sliceOf([])), 1);
    const slice = sliceOf([at(12)]);
    declare(slice, 'Wolves', 'common');
    assert.equal(slice.foes.groups.wolves.threat, 1, 'level 12: common is beneath');
});

test('the threat is fixed when declared: a later level-up does not re-rate a standing group; reinforcements keep it', () => {
    const slice = sliceOf([at(9)]);
    declare(slice, 'Wolves', 'common', 4);
    assert.equal(slice.foes.groups.wolves.threat, 2);
    slice.members.ac_astra001.xp = 5000;
    assert.equal(slice.foes.groups.wolves.threat, 2, 'the level rose, the record did not');
    const more = declare(slice, 'wolves', 'common', 2, NEXT);
    assert.deepEqual([more.result.data.reinforcements, slice.foes.groups.wolves.left, slice.foes.groups.wolves.threat], [true, 6, 2]);
    const other = declare(slice, 'Wolves', 'elite', 1, NEXT);
    assert.equal(other.result.data.reinforcements, false, 'another kind is a new group');
    assert.deepEqual([slice.foes.groups['wolves-2'].kind, slice.foes.groups['wolves-2'].threat], ['elite', 2], 'rated by the level now: 51 is in 30-59');
});

test('a bad or missing kind is refused with one receipt that names the kinds, and writes nothing; so is an old line with threat: and no kind', () => {
    for (const kind of ['dragon', 'mighty']) {
        const slice = sliceOf([at(1)]);
        const done = declare(slice, 'Rats', kind);
        assert.equal(done.code, 'INVALID', kind);
        assert.equal(done.message, '+ foes needs a kind: vermin, common, trained, elite, monster or legend', 'an unknown kind gets the same receipt as a missing one');
        assert.equal(slice.foes, undefined);
    }
    const none = sliceOf([at(1)]);
    assert.equal(declare(none, 'Rats', '').code, 'INVALID');
    const old = sliceOf([at(30)]);
    const done = declare(old, 'Rats', '', 24, SID, { threat: 'a fair match' });
    assert.equal(done.code, 'INVALID');
    assert.equal(done.message, '+ foes needs a kind: vermin, common, trained, elite, monster or legend');
    assert.equal(old.foes, undefined, 'the old line makes no group');
});
