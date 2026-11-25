// Companions earn XP with the party (owner, 25 Nov): joining sets their xp to the joining level's start, each + xp pays them as it pays the reader's character,
// every 100 is a level, a later join line can lift but never lower them, the fallen earn nothing, and the Party sheet shows their XP bar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { applyCompanion } from '../src/module-parts/kinds/roster.js';
import { levelOf, pointsOf } from '../src/module-parts/standing.js';
import { rowOf } from '../src/module-parts/sheet-row.js';
import { astra, fakeCtx, line, run, sliceOf, SID } from './helpers/fake-ctx.js';
import { withFoes } from './helpers/foes.js';

const fair = () => ({ list: [10, 10, 10], floor: 0, used: 1, hardest: 3, threat: 2 });
const torkaOf = s => Object.values(s.members).find(member => member.name === 'Torka');
const join = (s, level) => run(applyCompanion, fakeCtx(s), line('companion', 'Torka', '', { level: String(level), strengths: 'maul, berserker' }));
// A reply that rolled, over a record of 60 common rats; 4 fall (40 XP each).
const payFour = (s, sid = SID) => {
    s.dice[sid] = fair();
    return run(applyXp, fakeCtx(s, { sid }), line('xp', 'Party', 'the rats', { foes: '4' }));
};

test('a companion joins at the start of their level, with no points to spend', () => {
    const s = sliceOf([astra()], fair());
    assert.equal(join(s, 6).ok, true);
    const torka = torkaOf(s);
    assert.deepEqual([torka.xp, levelOf(torka), pointsOf(torka)], [500, 6, 0]);
});

test('+ xp Party pays the companion as it pays the reader, and every 100 is a level', () => {
    const s = withFoes(sliceOf([astra()], fair()), [['the rats', 60, 2]]);
    join(s, 6);
    const first = payFour(s);
    assert.equal(first.ok, true);
    assert.deepEqual([s.members.ac_astra001.xp, torkaOf(s).xp], [40, 540]);
    torkaOf(s).xp = 590;
    const second = payFour(s, 'sw_reply0002');
    assert.equal(levelOf(torkaOf(s)), 7);
    assert.match(second.result.summary, /Torka reaches level 7/);
});

test('a later join line lifts a companion but never lowers them', () => {
    const s = sliceOf([astra()], fair());
    join(s, 6);
    torkaOf(s).xp = 640;
    join(s, 3);
    assert.deepEqual([levelOf(torkaOf(s)), torkaOf(s).xp, torkaOf(s).companion.level], [7, 640, 7], 'a lower level is ignored');
    join(s, 9);
    assert.deepEqual([levelOf(torkaOf(s)), torkaOf(s).xp], [9, 800], 'a higher one lifts them to its start');
});

test('a fallen companion earns nothing; a named companion can be paid alone', () => {
    const s = withFoes(sliceOf([astra()], fair()), [['the rats', 60, 2]]);
    join(s, 2);
    torkaOf(s).fallen = { how: 'fell', at: 1 };
    payFour(s);
    assert.deepEqual([s.members.ac_astra001.xp, torkaOf(s).xp], [40, 100]);
    torkaOf(s).fallen = null;
    s.dice.sw_reply0003 = fair();
    run(applyXp, fakeCtx(s, { sid: 'sw_reply0003' }), line('xp', 'Torka', 'the rats', { foes: '1' }));
    assert.deepEqual([s.members.ac_astra001.xp, torkaOf(s).xp], [40, 110], 'one more rat (the battle holds 50 at most)');
});

test('the Party sheet shows a companion\'s XP bar', () => {
    const s = sliceOf([astra()], fair());
    join(s, 6);
    torkaOf(s).xp = 530;
    const row = rowOf(torkaOf(s));
    assert.deepEqual([row.line, row.xpPct, row.xpLabel, row.points, row.stats], ['Lv 6 · companion', 30, '30/100', 0, null]);
});
