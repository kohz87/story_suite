// The world daily step on the real host, replayed over a changed prefix: two replies that each crossed a day, then an edited Re-read
// of the first (grown, shrunk) and a middle delete of the reply that made the first step (and the campaign seed). Replay applies the
// later step's records (its state is a slot written whole); no store problems; holds stay on Active events; a later day still steps.
// And test 9 with rolls that matter: swipes of the crossing reply give the same outcome; an unseeded draw would not.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, chronicle, dailyOf, newHost, reply, SPEC, world } from './daily-host.helpers.js';

const day = host => Math.floor(host.head().domains.director.time.minutes / 1440);
const holdsActive = host => Object.values(chronicle(host).conditions ?? {}).every(entry => !entry.holds || entry.holds.every(id => dailyOf(host)?.events[id]?.state === 'active'));

async function check(host, label) {
    assert.deepEqual(host.store.problems(), [], `${label}: no store problems`);
    assert.ok(holdsActive(host), `${label}: every hold is an Active event's`);
    await agrees(host, label);
}

test('replay over a changed prefix: Re-read of the first crossing (grown, shrunk) and a middle delete of the first step keep the later records', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    await host.send('Day two.', reply('Dawn again.', ['! time +1d']));
    const first = host.ctx.chat.findIndex(message => /^Dawn\./.test(message.mes));
    const recorded = JSON.stringify(dailyOf(host));
    await check(host, 'live');
    await host.st.editMessage(first, reply('Dawn.', ['! time +3d']));
    assert.equal((await host.sdk.reread(first)).ok, true);
    assert.equal(JSON.stringify(dailyOf(host)), recorded, 'grown: the later reply\'s step is applied as recorded');
    await check(host, 'grown Re-read');
    await host.st.editMessage(first, reply('Dawn.', ['! time +1h']));
    assert.equal((await host.sdk.reread(first)).ok, true);
    // Shrunk: the clock is now a day behind what the later step recorded; nothing is stepped again or undone (history is kept).
    assert.equal(dailyOf(host).day, day(host) + 1, 'the stepped day is ahead of the clock after a shrunk Re-read');
    await check(host, 'shrunk Re-read');
    await host.send('Wait.', reply('Morning comes.', ['! time +12h']));
    assert.equal(dailyOf(host).day, day(host), 'the next day is stepped once the clock passes the recorded day');
    await check(host, 'after the shrunk Re-read');
    // The reply that made the first step (and drew the seed) is deleted: the later steps' records still apply.
    await host.st.deleteMessage(2);
    assert.equal(dailyOf(host)?.seed, JSON.parse(recorded).seed, 'the later step\'s state, seed included, is replayed');
    await check(host, 'middle delete of the first step');
    const before = dailyOf(host).day;
    await host.send('On.', reply('Another day.', ['! time +1d']));
    assert.equal(dailyOf(host).day, before + 1);
    await check(host, 'a live day after the delete');
    host.done();
});

test('test 9 on the host with rolls that matter: swiping the reply that crosses into a day gives the same outcome every time', async () => {
    const outcomes = [{ name: 'east', weight: 1 }, { name: 'west', weight: 1 }];
    const spec = { ...SPEC, events: [{ id: 'raid', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark'], window: { after: 'start + 1 day', within: '1 day' }, ends_when: 'instant', outcomes, summary: 'Raiders ride {outcome}.' }] };
    const seen = new Set();
    for (let run = 0; run < 6; run += 1) {
        const host = await newHost(true, spec);
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await host.send('Day.', reply('Dawn.', ['! time +1d']));
        const first = world(host);
        for (const text of ['Dawn, grey.', 'Dawn, red.', 'Dawn, cold.']) {
            await host.swipe(reply(text, ['! time +1d']));
            assert.equal(world(host), first, 'every swipe of the crossing reply: the same rolls and outcome');
        }
        assert.equal(dailyOf(host).events.raid.fired, dailyOf(host).day, 'it fires on the crossing day, its outcome drawn there');
        seen.add(dailyOf(host).events.raid.outcome);
        host.done();
    }
    assert.ok([...seen].every(name => name === 'east' || name === 'west'));
});

test('a step that changes a condition an earlier step made: deleting the earlier reply passes the change over (marked), and the rest of the step applies', async () => {
    const at = (id, days, text) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Bluewatch'], window: { after: `start + ${days} day${days > 1 ? 's' : ''}`, within: '1 day' }, ends_when: 'instant', effects: { set: [text] }, summary: id });
    const host = await newHost(true, { ...SPEC, events: [at('dry-spell', 1, 'grain-dear@The March: 2 days'), at('blight', 2, 'grain-dear@The March: 10 days')] });
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    await host.send('Day two.', reply('Dawn again.', ['! time +1d']));
    const entry = chronicle(host).conditions['grain-dear@The March'];
    assert.deepEqual([entry.by, entry.fadesAt - entry.since], ['event:dry-spell', 11 * 1440], 'blight kept the longer end on the entry dry-spell made');
    const step = host.ctx.chat.findIndex(message => /^Dawn\./.test(message.mes));
    await host.st.deleteMessage(step);
    // The later step only moved the entry's end (a patch inside it); with the entry gone that patch is passed over, the step's state still applies.
    assert.deepEqual(host.store.problems(), []);
    assert.equal(chronicle(host).conditions?.['grain-dear@The March'], undefined, 'known gap: the condition only the deleted step made is gone');
    assert.equal(dailyOf(host).events.blight.fired, dailyOf(host).day, 'while the later state still says blight fired');
    await agrees(host, 'delete under a changed condition');
    host.done();
});
