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

test('E14: after a day of fallback hours a face a few hours ahead stays ahead (the day before is taken only when it is nearer)', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 06:00 am']));
    const start = minutes(host);
    for (let n = 0; n < 25; n += 1) await host.send(`Wait ${n}.`, reply('Nothing moves.'));
    assert.equal(minutes(host), start + 25 * 60, '07:00 am the next day');
    await host.send('Plan.', reply('They plan.', ['~ time 10:00 am']));
    assert.equal(minutes(host), start + 1440 + 4 * 60, 'today\'s 10:00 am, not yesterday\'s');
    await agrees(host, 'long soft');
    host.done();
});

test('E14 replay: an edited Re-read of the fallback reply, an edited Re-read of the face reply, a delete of the first of two fallbacks, and a rewind', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    const start = minutes(host);
    await host.send('Rest.', reply('A quiet night.'));
    const fallback = host.ctx.chat.length - 1;
    await host.send('Talk.', reply('They talk.', ['~ time 08:30 pm']));
    const face = host.ctx.chat.length - 1;
    assert.equal(minutes(host), start + 30);
    // The fallback reply now tells its time: no soft minutes; the later face keeps its recorded set (a plain set stays where it was).
    await host.st.editMessage(fallback, reply('A quiet night.', ['! time +10m']));
    assert.equal((await host.sdk.reread(fallback)).ok, true);
    assert.equal(minutes(host), start + 30, 'the later face\'s recorded set stays');
    await agrees(host, 'fallback reply Re-read');
    await host.st.editMessage(fallback, reply('A quiet night.'));
    assert.equal((await host.sdk.reread(fallback)).ok, true);
    await host.st.editMessage(face, reply('They talk.', ['~ time 08:45 pm']));
    assert.equal((await host.sdk.reread(face)).ok, true);
    assert.equal(minutes(host), start + 45, 'the face reply read again, inside the fallback hour');
    await agrees(host, 'face reply Re-read');
    // Two fallbacks, then delete the first before any face: the second's soft no longer stands where the clock is, so a face back is refused.
    await host.send('Idle.', reply('Nothing.'));
    const firstIdle = host.ctx.chat.length - 1;
    await host.send('Idle again.', reply('Still nothing.'));
    await host.st.deleteMessage(firstIdle);
    assert.deepEqual(host.store.problems(), []);
    await agrees(host, 'first of two fallbacks deleted');
    await host.send('Back.', reply('Earlier?', ['~ time 09:00 pm']));
    assert.equal(refused(host).length, 1, 'the window was lost with the deleted fallback (pinned)');
    await agrees(host, 'after the lost window');
    while (host.ctx.chat.length > 3) await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(minutes(host), start);
    await agrees(host, 'rewound');
    host.done();
});

// Soak W4 on the fallback path: a face back over the fallback hour is an anchored `day` set when it is on the clock's own day, so deleting an
// earlier skip moves it with the day; a face back over midnight (the day before) stays a plain set, so a sub-day delete does not move it a day.
async function told(lines) {
    const host = await newHost();
    for (const [i, each] of lines.entries()) await host.send(`T${i}.`, reply(`R${i}.`, each));
    return host;
}
test('W4, fallback face: deleting an earlier skip before a fallback hour and `~ time 08:30 pm` gives what a fresh telling gives', async () => {
    const host = await told([['~ time June 3, 1200, 08:00 pm'], ['! time +3 days'], [], ['~ time 08:30 pm']]);
    const fresh = await told([['~ time June 3, 1200, 08:00 pm'], [], ['~ time 08:30 pm']]);
    assert.equal(host.sdk.query('director.time').text, 'June 6, 1200, 08:30 pm');
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(3);
    assert.equal(minutes(host), minutes(fresh), 'the face moved back with the day');
    await agrees(host, 'fallback face after a deleted skip');
    host.done(); fresh.done();
});
test('W4, fallback face over midnight: deleting an earlier `! time +1h` leaves the face where a fresh telling puts it (not a day early)', async () => {
    const host = await told([['~ time June 3, 1200, 10:30 pm'], ['! time +1h'], [], ['~ time 11:45 pm']]);
    const fresh = await told([['~ time June 3, 1200, 10:30 pm'], [], ['~ time 11:45 pm']]);
    assert.equal(host.sdk.query('director.time').text, 'June 3, 1200, 11:45 pm');
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(3);
    assert.equal(minutes(host), minutes(fresh));
    await agrees(host, 'fallback face over midnight after a delete');
    host.done(); fresh.done();
});
