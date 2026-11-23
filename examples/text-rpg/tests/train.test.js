// `~ train Who — Skill`, the failed-roll gain and the owner's rank thresholds: the numbers a skill's practice moves by and the ranks they reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTrain } from '../src/module-parts/kinds/pools.js';
import { applySpend } from '../src/module-parts/kinds/pools.js';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { skillRows } from '../src/module-parts/sheet-skills.js';
import { exportFile } from '../src/module-parts/export.js';
import { create } from '../src/module-parts/commands/create.js';
import { parseCharacterFile } from '../src/wizard/charfile.js';
import { RANKS } from '../src/words/ranks.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { astraOf, reply, withAstra } from './helpers/host.js';

const SIDS = ['sw_reply0001', 'sw_reply0002'];
const make = (threat, list = [11, 11, 11]) => {
    const slice = sliceOf([astra()], { list, floor: 0 });
    slice.dice[SIDS[1]] = { list: [11, 11, 11], floor: 0 };
    if (threat !== undefined) slice.dice[SIDS[0]].threat = threat;
    return slice;
};
const train = (slice, skill = 'Lore', sid = SIDS[0]) => {
    const done = run(applyTrain, fakeCtx(slice, { sid }), line('train', 'Astra', skill));
    assert.equal(done.ok, true, done.message);
    return done.result.data;
};
const spend = (slice, skill = 'Obscure', sid = SIDS[0]) => run(applySpend, fakeCtx(slice, { sid }), line('spend', 'Astra', skill)).result.data;
const attempt = (slice, what, word, sid = SIDS[0]) => run(applyTry, fakeCtx(slice, { sid }), line('try', 'Astra', `${what}; ${word}`)).result.data;
const lore = slice => slice.members.ac_astra001.practice.lore ?? 0;

test('a training scene teaches +1 with no cost and no roll, and says so in the receipt', () => {
    const slice = make();
    const sp = slice.members.ac_astra001.pools.sp.now;
    const done = run(applyTrain, fakeCtx(slice, { sid: SIDS[0] }), line('train', 'Astra', 'Obscure'));
    assert.deepEqual([done.result.data.practice, done.result.data.skill, done.result.summary], [1, 'Obscure', 'Astra trains Obscure.']);
    assert.equal(slice.members.ac_astra001.pools.sp.now, sp, 'a training scene costs nothing');
    assert.equal(slice.dice[SIDS[0]].used ?? 0, 0, 'and uses no die');
    assert.equal(run(applyTrain, fakeCtx(slice, { sid: SIDS[0] }), line('train', 'Astra', 'Nothing')).code, 'NOT_FOUND');
});

test('train is scaled by the threat so far: far beneath none, beneath 1 (half, at least 1), a fair match 1, above 2, far above 2', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => train(make(threat)).practice), [0, 1, 1, 2, 2, 2]);
});

test('train and spend share one gain a skill a reply; another skill or reply gains again', () => {
    const slice = make();
    assert.equal(train(slice).practice, 1);
    assert.equal(train(slice).practice, 0, 'a second line');
    assert.equal(spend(slice, 'Lore').practice, 0, 'a spend of the same skill after a train');
    assert.equal(train(slice, 'Obscure').practice, 1, 'another skill');
    assert.equal(train(slice, 'Lore', SIDS[1]).practice, 1, 'the next reply');
    assert.equal(lore(slice), 2);
});

test('a roll for the skill in the reply wins over a train, in either order', () => {
    const after = make();
    assert.equal(train(after).practice, 1);
    assert.equal(attempt(after, 'Lore', 'normal').practice, 5);
    assert.equal(lore(after), 5, 'the train gave its 1 back');
    assert.equal(train(after).practice, 0, 'and a train after the roll adds nothing');
    const before = make();
    attempt(before, 'Lore', 'normal');
    assert.equal(train(before).practice, 0);
    assert.equal(lore(before), 5);
});

test('a failed roll teaches +3 (a bad one too), scaled by the threat: beneath rounds 1.5 to 2, above 4.5 to 5', () => {
    const failed = make(undefined, [2, 2, 2]);
    assert.equal(attempt(failed, 'Lore', 'normal').practice, 3);
    const bad = make(undefined, [1, 1, 1]);
    const got = attempt(bad, 'Lore', 'normal');
    assert.equal(got.band, 'bad');
    assert.equal(got.practice, 3);
    const beneath = make(1, [2, 2, 2]);
    assert.equal(attempt(beneath, 'Lore', 'normal').practice, 2);
    const above = make(3, [2, 2, 2]);
    assert.equal(attempt(above, 'Lore', 'normal').practice, 5, 'the threat also raises the roll, so it only fails the harder');
});

test('the sheet\'s next rank reads the thresholds: from this rank\'s start to the next one\'s', () => {
    const at = practice => {
        const member = astra({ practice: { lore: practice } });
        return skillRows(member).find(row => row.name === 'Lore');
    };
    assert.deepEqual([0, 39, 40, 99, 100, 180, 280, 420, 599, 600].map(n => at(n).rank), ['Novice', 'Novice', 'Apprentice', 'Apprentice', 'Adept', 'Expert', 'Master', 'Grandmaster', 'Grandmaster', 'Legend']);
    assert.deepEqual(at(0).next, { name: 'Apprentice', at: 40, from: 0, minLevel: 1, levelOk: true });
    assert.deepEqual(at(120).next, { name: 'Expert', at: 180, from: 100, minLevel: 1, levelOk: true });
    assert.deepEqual(at(500).next, { name: 'Legend', at: 600, from: 420, minLevel: 1, levelOk: true });
    assert.equal(at(600).next, null);
});

test('a rank crossed by a train is told in the receipt', () => {
    const slice = make();
    slice.members.ac_astra001.practice.lore = 39;
    assert.equal(train(slice).rankUp, 'Apprentice');
});

test('an RPG file\'s rank becomes the practice that rank starts at, and an export gives the same rank back', () => {
    for (const [rank, practice] of RANKS.map((entry, at) => [at, entry.at]).slice(1, 7)) {
        const slice = sliceOf([]);
        const made = run(create, fakeCtx(slice), { name: 'Ren', level: 1, imported: true, budget: 49, stats: { str: 7, vit: 7, agi: 7, dex: 7, int: 7, wis: 7, cha: 7 }, skills: [{ name: 'Lore', stat: 'int', rank }] });
        const ren = slice.members[made.result.data.member];
        assert.equal(ren.practice.lore, practice, `rank ${rank}`);
        const file = parseCharacterFile(exportFile({ domains: { textRpg: slice } }, { id: ren.id }).text);
        assert.equal(file.ok, true, file.message);
        assert.equal(file.file.skills[0].rank, rank, 'practice → the rank it came from');
    }
});

test('a training scene through the real host counts once, and replay == live through a rebuild and a delete', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    const at = host.ctx.chat.length;
    await host.send('Study.', reply('She drills all day.', ['~ train Astra — Lore', '~ train Astra — Lore']));
    const lore = () => astraOf(host).practice.lore ?? 0;
    assert.equal(lore(), 1, 'the train counts once a reply');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
    await host.swipe(reply('Another day.', ['~ train Astra — Lore']));
    assert.equal(lore(), 1, 'a swipe replaces it');
    await host.st.deleteMessage(at + 1);
    await host.st.deleteMessage(at);
    assert.equal(lore(), 0, 'a delete takes it back');
    assert.deepEqual(host.store.problems(), []);
});
