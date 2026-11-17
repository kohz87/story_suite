// The fallback hour and the clock-face rule (seam audit E14): the narrator's explicit clock face beats the fallback, so a `~ time`
// face up to the fallback's minutes earlier than the clock is used (a plain set), not refused; earlier than that is still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, dailyOf, dailyReceipts, newHost, reply } from './daily-host.helpers.js';

const minutes = host => host.head().domains.director.time.minutes;
// A refused face: its receipt says "(not used)" (the reason is the Director's time problem).
const refused = host => host.sdk.receipts().filter(entry => entry.receipt.type === 'capture.time' && /\(not used\)$/.test(entry.receipt.summary));

test('E14: after a fallback hour a clock face within that hour is used; one before it is refused', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    const start = minutes(host);
    await host.send('Rest.', reply('A quiet night.'));
    assert.equal(minutes(host), start + 60);
    assert.equal(host.ctx.chat.at(-1).mes.includes('Changes'), false);
    await host.send('Talk.', reply('They talk.', ['~ time 08:30 pm']));
    assert.deepEqual(refused(host), [], 'a face inside the fallback hour is not refused');
    assert.equal(minutes(host), start + 30, 'the narrator\'s face beats the fallback');
    await agrees(host, 'face after fallback');
    await host.send('Idle.', reply('Nothing moves.'));
    assert.equal(minutes(host), start + 90);
    await host.send('Back.', reply('Earlier?', ['~ time 08:15 pm']));
    assert.equal(refused(host).length, 1, 'a face before the fallback hour is refused as before');
    assert.equal(minutes(host), start + 90);
    await agrees(host, 'refused face');
    host.done();
});

test('E14: two fallback hours add up; a face used resets them; a swipe and a middle delete replay as live', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 06:00 pm']));
    const start = minutes(host);
    await host.send('Rest.', reply('A quiet night.'));
    await host.send('More.', reply('Still quiet.'));
    assert.equal(minutes(host), start + 120);
    await host.send('Talk.', reply('They talk.', ['~ time 06:10 pm']));
    assert.equal(minutes(host), start + 10, 'down to two hours back');
    await host.swipe(reply('They talk on.', ['~ time 06:20 pm']));
    assert.equal(minutes(host), start + 20, 'a swipe reads its own face');
    await agrees(host, 'swipe');
    await host.send('Next.', reply('Later.'));
    await host.send('Again.', reply('Again.', ['~ time 06:00 pm']));
    assert.equal(refused(host).length, 1, 'the used face reset the fallback minutes: only the newest hour counts');
    await host.st.deleteMessage(4);
    assert.deepEqual(host.store.problems(), []);
    await agrees(host, 'middle delete');
    host.done();
});

test('E14: a fallback hour that crossed midnight stepped the new day; a face back before midnight undoes nothing and steps nothing twice', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 11:30 pm']));
    const start = minutes(host);
    const day = dailyOf(host).day;
    await host.send('Rest.', reply('Midnight passes.'));
    assert.equal(dailyOf(host).day, day + 1, 'the fallback hour crossed midnight: the new day is stepped');
    const stepped = dailyReceipts(host).length;
    await host.send('Talk.', reply('They talk.', ['~ time 11:45 pm']));
    assert.equal(minutes(host), start + 15, 'the face sets the clock back before midnight');
    assert.equal(dailyOf(host).day, day + 1, 'the stepped day stays (nothing is undone)');
    await host.send('Sleep.', reply('Morning.', ['! time 07:00 am']));
    assert.equal(dailyReceipts(host).length, stepped, 'crossing midnight again steps nothing twice');
    assert.equal(dailyOf(host).day, day + 1);
    await agrees(host, 'face back over midnight');
    host.done();
});
