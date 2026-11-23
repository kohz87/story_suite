// `~ train Who — Skill | sessions: N`: +1 a session, capped by the story days the reply's clock moved (the clock the dice step kept), once a skill a reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTrain } from '../src/module-parts/kinds/pools.js';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { beforeGenerate } from '../src/module-parts/hooks.js';
import { dice } from '../src/module-parts/commands/dice.js';
import { rollsOf } from '../src/module-parts/rolls.js';
import { rollCards } from '../src/module-parts/roll-cards.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { astraOf, reply, withAstra } from './helpers/host.js';

const step = clock => [{ index: 2, receipt: { type: 'textRpg.dice', data: { list: [11, 11, 11], floor: 0, own: true, ...(clock === undefined ? {} : { clock }) } } }];
const DAY = 1440;
const lore = slice => slice.members.ac_astra001.practice.lore ?? 0;
const train = (slice, sessions, { start, now } = {}, skill = 'Lore') => {
    const labels = sessions === undefined ? {} : { sessions };
    const done = run(applyTrain, fakeCtx(slice, { time: now ?? null, receipts: step(start) }), line('train', 'Astra', skill, labels));
    assert.equal(done.ok, true, done.message);
    return done.result.data;
};

test('sessions: N gives +N when the story had the days, with no threat scale', () => {
    const slice = sliceOf([astra()], { list: [11, 11, 11], floor: 0, threat: 0 });
    const data = train(slice, '30', { start: 0, now: 30 * DAY });
    assert.deepEqual([data.practice, data.sessions, data.asked, data.days], [30, 30, 30, 30]);
    assert.equal(lore(slice), 30);
});

test('sessions are capped by the whole days the clock moved (at least 1)', () => {
    assert.equal(train(sliceOf([astra()]), '30', { start: 0, now: 5 * DAY + 600 }).practice, 5);
    const none = train(sliceOf([astra()]), '30', { start: 100, now: 400 });
    assert.deepEqual([none.practice, none.days], [1, 1], 'less than a day still counts one');
});

test('a missing clock, a bad count or a missing count is one session; 60 is the most', () => {
    assert.equal(train(sliceOf([astra()]), '30').practice, 1, 'no clock at all');
    assert.equal(train(sliceOf([astra()]), '30', { now: 9 * DAY }).practice, 1, 'no clock at the start');
    for (const bad of ['0', '61', 'many', '-3', '2.5', '', undefined]) assert.equal(train(sliceOf([astra()]), bad, { start: 0, now: 99 * DAY }).practice, 1, `"${bad}"`);
    assert.equal(train(sliceOf([astra()]), '60', { start: 0, now: 99 * DAY }).practice, 60);
});

test('practice stops at 600 and the receipt says what was added', () => {
    const slice = sliceOf([astra({ practice: { lore: 590 } })]);
    assert.equal(train(slice, '60', { start: 0, now: 99 * DAY }).practice, 10);
    assert.equal(lore(slice), 600);
});

test('one line a skill a reply; sessions of 2 or more are not taken back by a roll of the same skill, in either order', () => {
    const live = { list: [11, 11, 11], floor: 0 };
    const attempt = slice => run(applyTry, fakeCtx(slice, { receipts: step(0) }), line('try', 'Astra', 'Lore; normal')).result.data;
    const after = sliceOf([astra()], live);
    assert.equal(train(after, '30', { start: 0, now: 30 * DAY }).practice, 30);
    assert.equal(train(after, '30', { start: 0, now: 30 * DAY }).practice, 0, 'a second line');
    attempt(after);
    assert.equal(lore(after), 35, 'training 30 plus the roll\'s 5');
    const before = sliceOf([astra()], live);
    attempt(before);
    assert.equal(train(before, '30', { start: 0, now: 30 * DAY }).practice, 30, 'a roll first does not stop it');
    assert.equal(lore(before), 35);
});

test('the dice step keeps the story minute, and the clock reaches the record a reply reads', () => {
    const view = { state: { domains: { textRpg: sliceOf([astra()], null), director: { time: { minutes: 4321 } } } }, settings: () => ({}), feature: () => true };
    const payload = beforeGenerate(view, { type: 'normal' })?.commands[0].payload;
    if (payload) assert.equal(payload.clock, 4321);
    const made = dice(fakeCtx(sliceOf([astra()]), { cause: 'system' }), { floor: 0, clock: 4321 });
    assert.equal(made.data.clock, 4321);
});

test('the Rolls card says the sessions, and the cap when the story had fewer days', () => {
    const rows = data => {
        const entries = [{ index: 3, receipt: { type: 'capture.train', data: { member: 'a', skill: 'Swordplay', practice: 30, rankUp: null, ...data } } }];
        return rollCards()['text-rpg-rolls'].for({ domains: { textRpg: { members: { a: { name: 'Astra' } } } } }, null, { index: 3, query: () => rollsOf(entries, 3, () => 'Astra') }).rows.at(-1).text;
    };
    assert.equal(rows({ sessions: 30, asked: 30, days: 30 }), 'Earned: Astra trained Swordplay: +30 (30 sessions)');
    assert.equal(rows({ practice: 5, sessions: 5, asked: 30, days: 5 }), 'Earned: Astra trained Swordplay: +5 (asked 30, story time 5 days)');
});

test('a training reply through the real host: replay == live, a swipe replaces it, a delete takes it back', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    const at = host.ctx.chat.length;
    await host.send('Study.', reply('Thirty days of drills.', ['~ train Astra — Lore | sessions: 30']));
    assert.equal(astraOf(host).practice.lore, 1, 'no story clock in this host: one session');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
    await host.swipe(reply('Another.', ['~ train Astra — Lore | sessions: 12']));
    assert.equal(astraOf(host).practice.lore, 1);
    await host.st.deleteMessage(at + 1);
    await host.st.deleteMessage(at);
    assert.equal(astraOf(host).practice.lore ?? 0, 0);
    assert.deepEqual(host.store.problems(), []);
});
