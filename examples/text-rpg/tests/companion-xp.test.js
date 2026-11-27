// Companions earn XP with the party (owner, 25 Nov): each + xp pays them as it pays the reader's character, and they level a step every 100 earned
// on top of the level they joined at; a later join line keeps that level; the fallen earn nothing; the Party sheet shows their XP bar; and a replay
// with the join reply deleted keeps the reader's XP (the companion's share is marked within them, ctx.ifThere).
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { applyCompanion } from '../src/module-parts/kinds/roster.js';
import { levelOf, pointsOf } from '../src/module-parts/standing.js';
import { rowOf } from '../src/module-parts/sheet-row.js';
import { astra, fakeCtx, line, run, sliceOf, SID } from './helpers/fake-ctx.js';
import { withFoes } from './helpers/foes.js';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const fair = () => ({ list: [10, 10, 10], floor: 0, used: 1, hardest: 3, threat: 2 });
const torkaOf = s => Object.values(s.members).find(member => member.name === 'Torka');
const join = (s, level) => run(applyCompanion, fakeCtx(s), line('companion', 'Torka', '', { level: String(level), strengths: 'maul, berserker' }));
// A reply that rolled, over a record of 60 common rats; `n` fall (10 XP each, 50 at most a battle).
const pay = (s, n, sid = SID, name = 'Party') => {
    s.dice[sid] = fair();
    return run(applyXp, fakeCtx(s, { sid }), line('xp', name, 'the rats', { foes: String(n) }));
};

test('a companion joins at their level with no xp held and no points to spend', () => {
    const s = sliceOf([astra()], fair());
    assert.equal(join(s, 6).ok, true);
    const torka = torkaOf(s);
    assert.deepEqual([torka.xp, levelOf(torka), pointsOf(torka)], [0, 6, 0]);
});

test('+ xp Party pays the companion as it pays the reader, and every 100 earned is a level', () => {
    const s = withFoes(sliceOf([astra()], fair()), [['the rats', 60, 2]]);
    join(s, 6);
    assert.equal(pay(s, 4).ok, true);
    assert.deepEqual([s.members.ac_astra001.xp, torkaOf(s).xp, levelOf(torkaOf(s))], [40, 40, 6]);
    torkaOf(s).xp = 95;
    const next = pay(s, 1, 'sw_reply0002');
    assert.deepEqual([torkaOf(s).xp, levelOf(torkaOf(s))], [105, 7]);
    assert.match(next.result.summary, /Torka reaches level 7/);
});

test('a later join line keeps the level they joined at (the xp levels stay on top) and changes the strengths', () => {
    const s = sliceOf([astra()], fair());
    join(s, 6);
    torkaOf(s).xp = 140;
    run(applyCompanion, fakeCtx(s), line('companion', 'Torka', '', { level: '3', strengths: 'axe' }));
    assert.deepEqual([torkaOf(s).companion.level, levelOf(torkaOf(s)), torkaOf(s).companion.strengths], [6, 7, ['axe']]);
    join(s, 9);
    assert.equal(levelOf(torkaOf(s)), 7, 'a higher number does not move them either: their level comes from the xp they earn');
});

test('a fallen companion earns nothing; a line naming the companion still pays the party', () => {
    const s = withFoes(sliceOf([astra()], fair()), [['the rats', 60, 2]]);
    join(s, 2);
    torkaOf(s).fallen = { how: 'fell', at: 1 };
    pay(s, 2);
    assert.deepEqual([s.members.ac_astra001.xp, torkaOf(s).xp], [20, 0]);
    torkaOf(s).fallen = null;
    pay(s, 1, 'sw_reply0003', 'Torka');
    assert.deepEqual([s.members.ac_astra001.xp, torkaOf(s).xp], [30, 10]);
});

test('the Party sheet shows a companion\'s XP bar; a saved companion (xp 0) starts it at 0', () => {
    const s = sliceOf([astra()], fair());
    join(s, 6);
    assert.deepEqual([rowOf(torkaOf(s)).xpPct, rowOf(torkaOf(s)).xpLabel], [0, '0/100']);
    torkaOf(s).xp = 230;
    const row = rowOf(torkaOf(s));
    assert.deepEqual([row.line, row.xpPct, row.xpLabel, row.points, row.stats], ['Lv 8 · companion', 30, '30/100', 0, null]);
});

test('replay == live: a rebuild gives the same companion, and deleting the join reply keeps the reader\'s XP and the foes count', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    const state = () => JSON.stringify(slice(host));
    await host.send('Hello.', 'The road.');
    const joinAt = host.ctx.chat.length;
    await host.send('Come.', reply('Torka joins.', ['+ companion Torka | level: 6 | strengths: maul']));
    await host.send('Rats.', reply('The rats come.', ['+ foes Rats | count: 24 | kind: common']));
    await host.send('Strike.', reply('Four fall.', ['? try Astra | Lore | hard | against: Rats', '+ xp Party — rats fall | foes: 4']));
    const torka = () => Object.values(slice(host).members).find(member => member.name === 'Torka');
    const paid = astraOf(host).xp;
    assert.ok(paid > 0);
    assert.equal(torka().xp, paid, 'the companion earned the same');
    const live = state();
    host.store.rebuild();
    assert.equal(state(), live, 'rebuild == live');
    await host.st.deleteMessage(joinAt + 1);
    await host.st.deleteMessage(joinAt);
    assert.deepEqual(host.store.problems(), []);
    assert.equal(torka(), undefined, 'no join, no Torka');
    assert.equal(astraOf(host).xp, paid, 'the reader keeps their XP');
    assert.equal(slice(host).foes.groups.rats.left, 20);
});

test('a line naming the reader\'s character pays the companion too (every + xp pays the party)', () => {
    const s = withFoes(sliceOf([astra()], fair()), [['the rats', 60, 2]]);
    join(s, 2);
    pay(s, 2, SID, 'Astra');
    assert.deepEqual([s.members.ac_astra001.xp, torkaOf(s).xp], [20, 20]);
});

test('someone who was not a companion before (a fallen character of the reader\'s) joins with no xp held', () => {
    const s = sliceOf([astra({ pc: false, fallen: { how: 'fell', at: 1 }, xp: 600 })], fair());
    const done = run(applyCompanion, fakeCtx(s), line('companion', 'Astra', '', { level: '3' }));
    assert.equal(done.ok, true);
    const back = s.members.ac_astra001;
    assert.deepEqual([back.xp, levelOf(back), back.fallen], [0, 3, null]);
});

test('a companion\'s id comes from their name, so editing the join line and pressing Re-read keeps the XP they earned', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Come.', reply('Torka joins.', ['+ companion Torka | level: 6 | strengths: maul']));
    const joinAt = host.ctx.chat.length - 1;
    const torka = () => Object.values(slice(host).members).find(member => member.name === 'Torka');
    const id = torka().id;
    await host.send('Rats.', reply('The rats come.', ['+ foes Rats | count: 24 | kind: common']));
    await host.send('Strike.', reply('Four fall.', ['? try Astra | Lore | hard | against: Rats', '+ xp Party — rats fall | foes: 4']));
    const earned = torka().xp;
    assert.ok(earned > 0);
    host.ctx.chat[joinAt].mes = host.ctx.chat[joinAt].mes.replace('strengths: maul', 'strengths: axe');
    assert.equal((await host.sdk.reread(joinAt)).ok, true);
    assert.deepEqual([torka().id, torka().xp, torka().companion.strengths], [id, earned, ['axe']]);
    assert.deepEqual(host.store.problems(), []);
});
