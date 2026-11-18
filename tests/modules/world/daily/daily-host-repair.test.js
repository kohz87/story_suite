// LAB-1: the fallback hour and the repair's own time line. A reply with no time line gets the world's fallback hour when it is read; the
// Assist repair's time line ("! time +5m") then replaces those untold minutes, it does not stack on them. Replay == live: swipe, swipe back,
// an edited Re-read (grown, shrunk), a middle delete, a rewind, a reload, a chat change.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { CORE_FEATURE } from '../../../../core/features.js';
import { createModule } from '../../../../modules/director/module.js';
import { FEATURE, agrees, dailyOf, dailyReceipts, reply, world } from './daily-host.helpers.js';

const minutes = host => host.head().domains.director.time.minutes;
const settle = () => new Promise(resolve => setTimeout(resolve, 60));

/** A host whose repair answers `answer.line` (null: the model says nothing); `on`: the world-events switch. */
async function started(answer, on = true, begin = 'June 3, 1200, 08:00 pm') {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id) } });
    host = await createHost({ modules: [module], callModel: async () => answer.line ?? 'Nothing to add.' });
    if (on) host.features.set(FEATURE, true);
    await host.send('Begin.', reply('Dust.', [`~ time ${begin}`]));
    host.features.set(CORE_FEATURE.extractor, true);
    return host;
}

test('LAB-1: the repair\'s time line counts from before the fallback hour; replay == live', async () => {
    const answer = { line: '! time +5m' };
    const host = await started(answer);
    const start = minutes(host);
    await host.send('Walk.', 'You walk on.');
    await settle();
    assert.equal(minutes(host), start + 5, 'five minutes, not the fallback hour and five more');
    await agrees(host, 'repair');
    answer.line = '! time +3h';
    await host.send('Ride.', 'You ride.');
    await settle();
    assert.equal(minutes(host), start + 5 + 180, 'a long stretch replaces the fallback hour too');
    answer.line = null;
    await host.send('Rest.', 'Quiet.');
    await settle();
    assert.equal(minutes(host), start + 5 + 180 + 60, 'no repair time line: the fallback hour stays');
    await agrees(host, 'no repair line');
    const last = host.ctx.chat.length - 1;
    await host.swipe('Quiet again.');
    await settle();
    await agrees(host, 'swipe');
    await host.st.swipeTo(last, 0);
    await agrees(host, 'swipe back');
    // A middle delete of the first repaired reply: the later ones keep their own minutes.
    const walk = 4;
    await host.st.deleteMessage(walk);
    assert.deepEqual(host.store.problems(), []);
    await agrees(host, 'middle delete');
    host.done?.();
    host.close();
});

test('LAB-1: only the repaired reply\'s own fallback hour is replaced; the untold hour of an earlier reply stays', async () => {
    const answer = { line: null };
    const host = await started(answer);
    const start = minutes(host);
    await host.send('Rest.', reply('Quiet.'));
    await settle();
    assert.equal(minutes(host), start + 60);
    answer.line = '! time +5m';
    await host.send('Walk.', reply('You walk on.'));
    await settle();
    assert.equal(minutes(host), start + 60 + 5, 'the earlier reply\'s hour stays, the repaired reply\'s own hour is replaced');
    await agrees(host, 'two replies');
    host.close();
});

test('LAB-1: an edited Re-read of a repaired reply (grown with its own line, shrunk to none) and a reload read as live', async () => {
    const answer = { line: '! time +5m' };
    const host = await started(answer);
    const start = minutes(host);
    await host.send('Walk.', 'You walk on.');
    await settle();
    await host.send('Next.', reply('Next.', ['! time +10m']));
    assert.equal(minutes(host), start + 15);
    const walk = 4;
    await host.st.editMessage(walk, reply('You walk on.', ['! time +30m']));
    { const r = await host.sdk.reread(walk); assert.equal(r.ok, true, JSON.stringify(r)); }
    assert.equal(minutes(host), start + 40, 'grown: its own line, no fallback hour, no repair on top');
    await agrees(host, 'grown Re-read');
    await host.st.editMessage(walk, 'You walk on.');
    { const r = await host.sdk.reread(walk); assert.equal(r.ok, true, JSON.stringify(r)); }
    await settle();
    await agrees(host, 'shrunk Re-read');
    await host.turn.onChatChanged();
    await agrees(host, 'reload');
    host.close();
});

test('LAB-1: with the switch off a repaired reply moves the clock by its own line only (as main does)', async () => {
    const answer = { line: '! time +5m' };
    const host = await started(answer, false);
    const start = minutes(host);
    await host.send('Walk.', 'You walk on.');
    await settle();
    assert.equal(minutes(host), start + 5);
    host.close();
});

const domains = host => JSON.stringify(host.head().domains);

test('LAB-1: an unedited Re-read of a repaired reply, a rewind and a chat change all equal live', async () => {
    const answer = { line: '! time +5m' };
    const host = await started(answer);
    const start = minutes(host);
    await host.send('Walk.', reply('You walk on.'));
    await settle();
    await host.send('Next.', reply('Next.', ['! time +10m']));
    const live = domains(host);
    assert.equal(minutes(host), start + 15);
    const r = await host.sdk.reread(4);
    assert.equal(r.ok, true, JSON.stringify(r));
    await settle();
    assert.equal(domains(host), live, 'a plain Re-read of the repaired reply changes nothing');
    await agrees(host, 'unedited Re-read');
    // A rewind: the last exchange is taken away (delete the reply and the message before it).
    const chat = structuredClone(host.ctx.chat);
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(minutes(host), start + 5);
    await agrees(host, 'rewind');
    // A chat change: another chat, then back to this one.
    await host.st.loadChat([], 'other-chat');
    await host.st.loadChat(chat, host.ctx.chatId === 'other-chat' ? 'chat-1' : host.ctx.chatId);
    await settle();
    assert.equal(minutes(host), start + 15);
    await agrees(host, 'chat change');
    host.close();
});

test('LAB-1, known limit (E14): the fallback hour crossing midnight stepped the new day; the repair takes the clock back and the stepped day stays (nothing is undone); a Re-read of the reply drops the step', async () => {
    const answer = { line: '! time +5m' };
    const host = await started(answer, true, 'June 3, 1200, 11:30 pm');
    const start = minutes(host);
    const day = dailyOf(host).day;
    await host.send('Walk.', reply('You walk on.'));
    await settle();
    assert.equal(minutes(host), start + 5, 'the repair\'s five minutes: the clock is still on the story\'s day');
    assert.equal(dailyOf(host).day, day + 1, 'live: the world stepped the new day when the fallback hour crossed midnight, as E14 pins it');
    assert.equal(dailyReceipts(host).filter(entry => entry.index === 4).length, 1);
    await agrees(host, 'live midnight');
    // A Re-read of the reply reads its repaired line inline: no fallback hour, so no day step for it. It is the more exact world.
    const r = await host.sdk.reread(4);
    assert.equal(r.ok, true, JSON.stringify(r));
    await settle();
    assert.equal(minutes(host), start + 5);
    assert.equal(dailyOf(host).day, day, 'after the Re-read the world is on the story\'s day');
    assert.deepEqual(dailyReceipts(host).filter(entry => entry.index === 4), []);
    await agrees(host, 'midnight after Re-read');
    host.close();
});
