// The world daily step on the real host: recorded on the reply that crossed the day, the clock fallback, the long-skip note,
// Problems, and replay == live through swipe, swipe back, edited Re-reads (grown, shrunk), a middle delete, a rewind, a reload
// and a chat change. With the switch off nothing is stepped and no hour is added.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, chronicle, dailyReceipts, newHost, reply, SPEC, world } from './daily-host.helpers.js';

const minutes = host => host.head().domains.director.time.minutes;
const advances = host => host.sdk.receipts().filter(entry => entry.receipt.type === 'director.advance' && entry.receipt.data.cause === 'world-clock');

async function play(host) {
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Rest.', reply('A quiet night.'));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    await host.send('Next.', reply('Noon.', ['! time +2h']));
}

test('test 35 and 16 (clock): a reply with no time line adds the fallback hour; a time line (3 days, 20 minutes) adds none; an edited Re-read that adds a line drops it', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    const start = minutes(host);
    await host.send('Rest.', reply('A quiet night.'));
    assert.equal(minutes(host), start + 60, 'no time line → about an hour');
    await host.send('Skip.', reply('Three days later.', ['! time +3d']));
    assert.equal(minutes(host), start + 60 + 3 * 1440, 'exactly 3 days, no fallback hour');
    await host.send('Brief.', reply('A short wait.', ['! time +20m']));
    assert.equal(minutes(host), start + 60 + 3 * 1440 + 20, '20 minutes, not the fallback hour');
    assert.deepEqual(advances(host).map(entry => entry.index), [4]);
    await host.st.editMessage(4, reply('A quiet night.', ['! time +30m']));
    assert.equal((await host.sdk.reread(4)).ok, true);
    assert.deepEqual(advances(host).map(entry => entry.index), [], 'the edited reply has a time line now: no fallback hour');
    assert.equal(minutes(host), start + 30 + 3 * 1440 + 20);
    await agrees(host, 'fallback Re-read');
    host.done();
});

test('on the host: the step is recorded on the reply that crossed the day, and replay == live through swipe, swipe back, edited Re-reads, delete, rewind, reload and chat change', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Rest.', reply('A quiet night.'));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    const crossing = host.ctx.chat.length - 1;
    assert.ok(dailyReceipts(host).some(entry => entry.index === crossing), 'the reply with "+1d" carries the step');
    assert.equal(chronicle(host).daily.day, Math.floor(minutes(host) / 1440));
    const before = world(host);
    // Test 9: a swipe of the reply that crossed the day gives the same rolls (campaign seed + day + event id); swipe back restores it.
    await host.swipe(reply('Dawn, grey.', ['! time +1d']));
    assert.equal(world(host), before, 'a swipe of the crossing reply: the same world');
    await agrees(host, 'swipe');
    await host.st.swipeTo(crossing, 0);
    assert.equal(world(host), before, 'swipe back');
    await agrees(host, 'swipe back');
    await host.send('Next.', reply('Noon.', ['! time +2h']));
    const later = world(host);
    // An edited Re-read of the crossing reply: shrunk (no day crossed: no step on it), grown (+5d: more days stepped), back.
    await host.st.editMessage(crossing, reply('Dawn.', ['! time +1h']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    assert.equal(dailyReceipts(host).some(entry => entry.index === crossing), false, 'shrunk: no day crossed, no step on it');
    await agrees(host, 'shrunk Re-read');
    await host.st.editMessage(crossing, reply('Dawn.', ['! time +5d']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    assert.equal(dailyReceipts(host).find(entry => entry.index === crossing).receipt.data.days, 5, 'grown: the days of the skip are stepped');
    await agrees(host, 'grown Re-read');
    await host.st.editMessage(crossing, reply('Dawn.', ['! time +1d']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    assert.equal(world(host), later, 'edited back: as it was (the same seed, day and ids)');
    // A middle delete, a chat change and back, then a rewind to the start.
    await host.st.deleteMessage(crossing);
    assert.deepEqual(host.store.problems(), []);
    await agrees(host, 'middle delete');
    const chat = structuredClone(host.ctx.chat);
    await host.st.loadChat([{ name: 'Other', is_user: false, mes: 'Elsewhere.' }]);
    assert.equal(chronicle(host).daily, undefined, 'another chat has no world days');
    await host.st.loadChat(chat);
    await agrees(host, 'chat change and back');
    while (host.ctx.chat.length > 3) await host.st.deleteMessage(host.ctx.chat.length - 1);
    await agrees(host, 'rewound');
    host.done();
});

test('test 10 (the replay part): a prose edit of an earlier reply re-captures only that reply; later recorded days are not rolled again', async () => {
    const host = await newHost();
    await play(host);
    await host.send('Later.', reply('Days pass.', ['! time +4d']));
    const later = dailyReceipts(host).at(-1);
    const daily = JSON.stringify(chronicle(host).daily);
    const rest = host.ctx.chat.findIndex(message => /A quiet night\./.test(message.mes));
    await host.st.editMessage(rest, reply('A quiet, cold night.'));
    assert.equal((await host.sdk.reread(rest)).ok, true);
    assert.equal(JSON.stringify(chronicle(host).daily), daily, 'the later days are as recorded');
    assert.deepEqual(dailyReceipts(host).at(-1).receipt.data, later.receipt.data);
    await agrees(host, 'prose edit');
    host.done();
});

test('test 11 and 16 (skip): a skip steps every day once (one step, rolls and fades per day) and over 30 days says "N world days simulated"', async () => {
    const host = await newHost();
    await play(host);
    const day = chronicle(host).daily.day;
    await host.send('Long.', reply('Seasons turn.', ['! time +45d']));
    const step = dailyReceipts(host).at(-1).receipt;
    assert.equal(step.data.days, 45);
    assert.deepEqual([step.data.from, step.data.to], [day + 1, day + 45]);
    assert.match(step.summary, /45 world days simulated/);
    await host.send('Short.', reply('A week later.', ['! time +7d']));
    assert.doesNotMatch(dailyReceipts(host).at(-1).receipt.summary, /world days simulated/);
    await agrees(host, 'skip');
    host.done();
});

test('test 44 (the daily part): a step warning goes to Problems, on the reply that caused it', async () => {
    const bad = { ...SPEC, events: [{ id: 'riot', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark'], window: { after: 'start', within: '1 day' }, ends_when: 'instant', effects: { set: ['plague@Highmark'] } }] };
    const host = await newHost(true, bad);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    const found = host.turn.problems().find(item => /plague/.test(item.message));
    assert.ok(found, 'the unknown condition is a Problem');
    assert.equal(found.index, dailyReceipts(host)[0].index);
    host.done();
});

test('switch off: no step, no fallback hour, no daily field, no world conditions', async () => {
    const host = await newHost(false);
    await play(host);
    await host.send('Long.', reply('Seasons turn.', ['! time +45d']));
    assert.equal('daily' in chronicle(host), false);
    assert.equal('conditions' in chronicle(host), false);
    assert.deepEqual(dailyReceipts(host), []);
    assert.deepEqual(advances(host), []);
    await agrees(host, 'off', false);
    host.done();
});
